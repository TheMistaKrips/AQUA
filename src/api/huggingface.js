const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;

export async function generateVideo(prompt, config) {
    const { count = 1, referenceImages = [] } = config;

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
        console.log("📝 Референса нет, режим: Text-to-Video");
    }

    const tasks = Array.from({ length: count }).map(async (_, index) => {
        try {
            if (index > 0) await new Promise(res => setTimeout(res, index * 2000));

            const createUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${GEMINI_API_KEY}`;

            const instance = {
                prompt: prompt || "Cinematic video, masterpiece, high quality"
            };

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

            console.log(`[Видео ${index + 1}] ⏳ Задача принята! ID: ${operationName}. Ожидаем рендера...`);

            const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${GEMINI_API_KEY}`;

            for (let attempt = 1; attempt <= 40; attempt++) {
                await new Promise(res => setTimeout(res, 10000));

                const pollRes = await fetch(pollUrl);
                if (!pollRes.ok) continue;

                const pollData = await pollRes.json();
                console.log(`[Видео ${index + 1}] Статус рендера (${attempt}/40)...`);

                if (pollData.done) {
                    if (pollData.error) {
                        console.error(`[Видео ${index + 1}] ❌ Ошибка при рендере видео:`, pollData.error);
                        return null;
                    }

                    console.log(`[Видео ${index + 1}] 🎉 ГОТОВО! Видео отрендерено, распаковываем...`);

                    // 🕵️‍♂️ УМНАЯ ИЩЕЙКА ВИДЕО
                    // Сканируем весь JSON ответа и ищем огромный файл или прямую ссылку
                    let responseVideo = null;
                    const findVideoInJSON = (obj) => {
                        if (!obj || typeof obj !== 'object') return;
                        for (let key in obj) {
                            const val = obj[key];
                            if (typeof val === 'string') {
                                // Если строка гигантская (> 50 тысяч символов), это 100% наше видео в Base64
                                if (val.length > 50000) {
                                    responseVideo = val;
                                    return;
                                }
                                // Если это публичная ссылка на видео
                                if (val.startsWith('http') && (val.includes('.mp4') || val.includes('video'))) {
                                    responseVideo = val;
                                    return;
                                }
                            } else if (typeof val === 'object') {
                                findVideoInJSON(val); // Копаем глубже
                            }
                        }
                    };

                    findVideoInJSON(pollData.response);

                    if (responseVideo) {
                        if (responseVideo.startsWith('http')) {
                            // Если это прямая ссылка
                            if (!responseVideo.includes('key=')) {
                                responseVideo += (responseVideo.includes('?') ? '&' : '?') + `key=${GEMINI_API_KEY}`;
                            }
                            return responseVideo;
                        }
                        else {
                            // Молниеносная конвертация Base64 в Blob без зависания браузера
                            console.log(`[Видео ${index + 1}] Конвертируем Base64 в .mp4 файл...`);
                            const res = await fetch(`data:video/mp4;base64,${responseVideo}`);
                            const blob = await res.blob();
                            return URL.createObjectURL(blob);
                        }
                    }

                    console.error(`[Видео ${index + 1}] ❌ Не удалось найти ни ссылку, ни Base64 в ответе!`);
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