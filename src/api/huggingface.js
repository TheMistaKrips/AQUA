const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;

export async function generateVideo(prompt, config) {
    // Получаем соотношение сторон из конфига (по умолчанию 16:9)
    const { count = 1, referenceImages = [], aspectRatio = "16:9" } = config;

    // ВАЖНО: Veo Lite не поддерживает генерацию по картинке. 
    // Для картинок и интерполяции используем Fast-версию.
    const isImageToVideo = referenceImages.length > 0;
    const model = isImageToVideo
        ? "veo-3.1-fast-generate-preview"
        : "veo-3.1-lite-generate-preview";

    console.log(`=== СТАРТ ГЕНЕРАЦИИ ВИДЕО (Google ${model}) ===`);

    let base64Image1 = null;
    let mimeType1 = null;
    let base64Image2 = null;
    let mimeType2 = null;

    if (isImageToVideo) {
        // Первый кадр
        const imgData1 = referenceImages[0];
        mimeType1 = imgData1.substring(imgData1.indexOf(':') + 1, imgData1.indexOf(';'));
        base64Image1 = imgData1.split(',')[1];
        console.log("Главный референс (первый кадр) загружен.");

        // Второй кадр (для интерполяции), если пользователь загрузил 2 картинки
        if (referenceImages.length > 1) {
            const imgData2 = referenceImages[1];
            mimeType2 = imgData2.substring(imgData2.indexOf(':') + 1, imgData2.indexOf(';'));
            base64Image2 = imgData2.split(',')[1];
            console.log("Второй референс (последний кадр) загружен. Включен режим интерполяции.");
        }
    } else {
        console.log("Референса нет, режим: Text-to-Video");
    }

    const tasks = Array.from({ length: count }).map(async (_, index) => {
        try {
            if (index > 0) await new Promise(res => setTimeout(res, index * 2000));

            const createUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${GEMINI_API_KEY}`;

            const instance = {
                prompt: prompt || "Cinematic video, masterpiece, high quality"
            };

            if (base64Image1) {
                instance.image = {
                    mimeType: mimeType1,
                    bytesBase64Encoded: base64Image1
                };
            }

            // Если есть вторая картинка, передаем ее как последний кадр
            if (base64Image2) {
                instance.lastFrame = {
                    mimeType: mimeType2,
                    bytesBase64Encoded: base64Image2
                };
            }

            console.log(`[Видео ${index + 1}] Отправляем задачу на рендер (Формат: ${aspectRatio})...`);

            const createResponse = await fetch(createUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [instance],
                    parameters: {
                        aspectRatio: aspectRatio,
                        resolution: "720p",
                        durationSeconds: 6 // Значение строкой для безопасности
                    }
                })
            });

            if (!createResponse.ok) {
                const errData = await createResponse.json().catch(() => ({}));
                console.error(`[Видео ${index + 1}] Ошибка создания задачи Google:`, errData);
                return null;
            }

            const operationData = await createResponse.json();
            const operationName = operationData.name;

            if (!operationName) {
                console.error(`[Видео ${index + 1}] Сервер не вернул ID операции:`, operationData);
                return null;
            }

            console.log(`[Видео ${index + 1}] Задача принята! ID: ${operationName}. Ожидаем рендера...`);

            const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${GEMINI_API_KEY}`;

            for (let attempt = 1; attempt <= 40; attempt++) {
                await new Promise(res => setTimeout(res, 10000));

                const pollRes = await fetch(pollUrl);
                if (!pollRes.ok) continue;

                const pollData = await pollRes.json();
                console.log(`[Видео ${index + 1}] Статус рендера (${attempt}/40)...`);

                if (pollData.done) {
                    if (pollData.error) {
                        console.error(`[Видео ${index + 1}] Ошибка при рендере видео:`, pollData.error);
                        return null;
                    }

                    console.log(`[Видео ${index + 1}] ГОТОВО! Ответ от сервера получен.`);

                    const samples = pollData.response?.generateVideoResponse?.generatedSamples;
                    let videoUri = null;

                    if (samples && samples.length > 0) {
                        videoUri = samples[0]?.video?.uri;
                    }

                    if (videoUri) {
                        if (!videoUri.includes('key=')) {
                            videoUri += (videoUri.includes('?') ? '&' : '?') + `key=${GEMINI_API_KEY}`;
                        }
                        console.log(`[Видео ${index + 1}] Итоговая ссылка:`, videoUri);
                        return videoUri;
                    }

                    console.error(`[Видео ${index + 1}] Не удалось извлечь URI видео!`, pollData);
                    return null;
                }
            }

            console.error(`[Видео ${index + 1}] Время ожидания истекло.`);
            return null;

        } catch (error) {
            console.error(`[Видео ${index + 1}] Сетевая ошибка браузера:`, error.message);
            return null;
        }
    });

    const results = await Promise.all(tasks);
    return results.filter(url => url !== null);
}