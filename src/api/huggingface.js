const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;

export async function generateVideo(prompt, config) {
    const { count = 1, referenceImages = [] } = config;

    // Возвращаем Fast-версию, чтобы видео генерировалось быстрее
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
                        aspectRatio: "16:9"
                        // ⚠️ Убрали durationSeconds, чтобы не ловить 400 Bad Request
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

                    console.log(`[Видео ${index + 1}] 🎉 ГОТОВО! Ответ от сервера получен.`);

                    // 🎯 ИЗВЛЕКАЕМ ВИДЕО ПО ТОЧНОЙ СТРУКТУРЕ REST API
                    const samples = pollData.response?.generateVideoResponse?.generatedSamples;
                    let videoUri = null;

                    if (samples && samples.length > 0) {
                        videoUri = samples[0]?.video?.uri;
                    }

                    if (videoUri) {
                        // Файлам из Gemini Files API нужен ключ для скачивания (обход 403 ошибки)
                        if (!videoUri.includes('key=')) {
                            videoUri += (videoUri.includes('?') ? '&' : '?') + `key=${GEMINI_API_KEY}`;
                        }
                        console.log(`[Видео ${index + 1}] 🎥 Итоговая ссылка:`, videoUri);
                        return videoUri;
                    }

                    console.error(`[Видео ${index + 1}] ❌ Не удалось извлечь URI видео из структуры REST API!`, pollData);
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