const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;

export async function generateVideo(prompt, config) {
    const { count = 1, referenceImages = [] } = config;

    // Переключаемся на Veo 3.1 Fast, если есть картинка
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
        console.log("📸 Обнаружен референс, режим: Image-to-Video");
    } else {
        console.log("📝 Референса нет, режим: Text-to-Video!");
    }

    const tasks = Array.from({ length: count }).map(async (_, index) => {
        try {
            if (index > 0) await new Promise(res => setTimeout(res, index * 2000));

            const createUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${GEMINI_API_KEY}`;

            // СТРОГО по документации Google Vertex/Gemini для Veo
            const instance = {
                prompt: prompt || "Cinematic video, masterpiece, high quality"
            };

            // ⚠️ ВАЖНО: Ключ ДОЛЖЕН называться "image", а не "firstFrame" !
            if (base64Image) {
                instance.image = {
                    mimeType: mimeType,
                    bytesBase64Encoded: base64Image
                };
            }

            console.log(`[Видео ${index + 1}] Отправляем задачу на рендер...`);

            const createResponse = await fetch(createUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [instance],
                    // Google требует явного указания параметров для видео
                    parameters: {
                        aspectRatio: "16:9",
                        resolution: "720p",
                        durationSeconds: 8,
                        sampleCount: 1
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

            console.log(`[Видео ${index + 1}] ⏳ Задача принята! ID: ${operationName}. Ожидаем рендера (обычно 30-90 сек)...`);

            const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${GEMINI_API_KEY}`;

            for (let attempt = 1; attempt <= 40; attempt++) {
                await new Promise(res => setTimeout(res, 10000)); // Проверяем статус каждые 10 секунд

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

                    let responseVideo = pollData.response?.videoUri
                        || pollData.response?.predictions?.[0]?.videoUri
                        || pollData.response?.generatedVideoUri
                        || pollData.response?.predictions?.[0]?.bytesBase64Encoded;

                    if (responseVideo) {
                        if (responseVideo.startsWith('http')) {
                            // Обязательно добавляем API-ключ к ссылке на скачивание, иначе будет 403 Forbidden
                            if (!responseVideo.includes('key=')) {
                                responseVideo += (responseVideo.includes('?') ? '&' : '?') + `key=${GEMINI_API_KEY}`;
                            }
                            return responseVideo;
                        }
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

                    console.error(`[Видео ${index + 1}] ❌ Не удалось найти видео в ответе.`, pollData);
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