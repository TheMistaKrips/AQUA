const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;

export async function generateVideo(prompt, config) {
    const { count = 1, referenceImages = [] } = config;

    // ВАЖНО: Veo Lite не поддерживает генерацию по картинке. 
    // Если есть картинка, переключаемся на Veo 3.1 Fast, иначе оставляем Lite
    const isImageToVideo = referenceImages.length > 0;
    const model = isImageToVideo
        ? "veo-3.1-fast-generate-preview"
        : "veo-3.1-lite-generate-preview";

    console.log(`=== СТАРТ ГЕНЕРАЦИИ ВИДЕО (Google ${model}) ===`);

    let base64Image = null;
    let mimeType = null;

    if (isImageToVideo) {
        const imgData = referenceImages[0];
        mimeType = imgData.substring(imgData.indexOf(':') + 1, imgData.indexOf(';'));
        base64Image = imgData.split(',')[1];
        console.log("📸 Обнаружен референс, режим: Image-to-Video (Задаем как первый кадр)!");
    } else {
        console.log("📝 Референса нет, режим: Text-to-Video!");
    }

    const tasks = Array.from({ length: count }).map(async (_, index) => {
        try {
            if (index > 0) await new Promise(res => setTimeout(res, index * 2000));

            // 1. Создаем задачу через правильный эндпоинт для тяжелых видео-моделей
            const createUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${GEMINI_API_KEY}`;

            // Структура запроса для Veo отличается от обычного Gemini!
            const instance = {
                prompt: prompt || "Cinematic video, masterpiece, high quality"
            };

            // Если есть картинка, Google требует передавать ее как firstFrame (первый кадр видео)
            if (base64Image) {
                instance.firstFrame = {
                    bytesBase64Encoded: base64Image,
                    mimeType: mimeType
                };
            }

            console.log(`[Видео ${index + 1}] Отправляем задачу на рендер...`);

            const createResponse = await fetch(createUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [instance],
                    parameters: {
                        aspectRatio: "16:9" // Можно менять на 9:16
                    }
                })
            });

            if (!createResponse.ok) {
                const errData = await createResponse.json().catch(() => ({}));
                console.error(`[Видео ${index + 1}] ❌ Ошибка создания задачи Google:`, errData);
                return null;
            }

            const operationData = await createResponse.json();
            const operationName = operationData.name;

            if (!operationName) {
                console.error(`[Видео ${index + 1}] ❌ Сервер не вернул ID операции:`, operationData);
                return null;
            }

            console.log(`[Видео ${index + 1}] ⏳ Задача принята! ID: ${operationName}. Ожидаем рендера (это может занять 1-2 минуты)...`);

            // 2. Цикл опроса статуса (Polling)
            const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${GEMINI_API_KEY}`;

            for (let attempt = 1; attempt <= 40; attempt++) {
                await new Promise(res => setTimeout(res, 10000)); // Ждем 10 секунд перед каждой проверкой статуса

                const pollRes = await fetch(pollUrl);
                if (!pollRes.ok) continue;

                const pollData = await pollRes.json();
                console.log(`[Видео ${index + 1}] Статус рендера (${attempt}/40)...`);

                if (pollData.done) {
                    if (pollData.error) {
                        console.error(`[Видео ${index + 1}] ❌ Ошибка при рендере видео:`, pollData.error);
                        return null;
                    }

                    console.log(`[Видео ${index + 1}] 🎉 ГОТОВО! Ответ от Google получен:`, pollData);

                    // Извлекаем ссылку или base64 файл
                    const responseVideo = pollData.response?.videoUri
                        || pollData.response?.predictions?.[0]?.videoUri
                        || pollData.response?.generatedVideoUri
                        || pollData.response?.predictions?.[0]?.bytesBase64Encoded;

                    if (responseVideo) {
                        // Если видео пришло обычной прямой ссылкой (URI)
                        if (responseVideo.startsWith('http')) {
                            return responseVideo;
                        }
                        // Если видео пришло "встроенным" куском кода (Base64)
                        else {
                            const byteCharacters = atob(responseVideo);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: 'video/mp4' });
                            return URL.createObjectURL(blob);
                        }
                    }

                    console.error(`[Видео ${index + 1}] ❌ Не удалось найти видео в ответе. Посмотри структуру в консоли.`);
                    return null;
                }
            }

            console.error(`[Видео ${index + 1}] ❌ Время ожидания истекло.`);
            return null;

        } catch (error) {
            console.error(`[Видео ${index + 1}] ❌ Сетевая ошибка браузера:`, error.message);
            return null;
        }
    });

    const results = await Promise.all(tasks);
    return results.filter(url => url !== null);
}