const HF_TOKEN = import.meta.env.VITE_HF_API_KEY;

export async function generateVideo(prompt, config) {
    const { referenceImages = [], duration = 'short', count = 1 } = config;

    console.log("=== СТАРТ ГЕНЕРАЦИИ HF ===");
    console.log("🔑 Токен загружен:", HF_TOKEN ? `Да (начинается на ${HF_TOKEN.substring(0, 5)}...)` : "НЕТ! Ошибка файла .env");

    const isImageToVideo = referenceImages.length > 0;
    const model = isImageToVideo
        ? "stabilityai/stable-video-diffusion-img2vid-xt"
        : "damo-vilab/text-to-video-ms-1.7b";

    console.log(`🤖 Выбрана модель: ${model}`);

    let payload;
    if (isImageToVideo) {
        const base64Data = referenceImages[0].split(',')[1];
        console.log(`🖼 Размер отправляемой картинки: ~${Math.round(base64Data.length / 1024)} KB`);
        payload = {
            inputs: { image: base64Data },
            parameters: { fps_id: duration === 'long' ? 12 : 6, motion_bucket_id: 127 }
        };
    } else {
        payload = { inputs: prompt };
    }

    const maxRetries = 10;
    const retryDelay = 5000;

    const tasks = Array.from({ length: count }).map(async (_, index) => {
        await new Promise(res => setTimeout(res, index * 1000));

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
                    headers: {
                        "Authorization": `Bearer ${HF_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                    method: "POST",
                    body: JSON.stringify(payload),
                });

                console.log(`[Видео ${index + 1}] Ответ сервера: Статус ${response.status}`);

                if (response.status === 503) {
                    console.log(`[Видео ${index + 1}] Модель загружается в память. Ждем 5 сек...`);
                    await new Promise(res => setTimeout(res, retryDelay));
                    continue;
                }

                if (!response.ok) {
                    const errText = await response.text();
                    console.error(`[Видео ${index + 1}] ❌ ОШИБКА HF:`, errText);
                    return null;
                }

                // Проверяем, что нам реально вернули видео (а не JSON с ошибкой)
                const contentType = response.headers.get("content-type");
                console.log(`[Видео ${index + 1}] Тип полученного файла:`, contentType);

                if (contentType && contentType.includes("application/json")) {
                    const jsonErr = await response.json();
                    console.error(`[Видео ${index + 1}] ❌ Сервер вернул JSON вместо видео:`, jsonErr);
                    return null;
                }

                const blob = await response.blob();
                console.log(`[Видео ${index + 1}] ✅ Видео успешно получено! Размер: ~${Math.round(blob.size / 1024)} KB`);
                return URL.createObjectURL(blob);

            } catch (error) {
                console.error(`[Видео ${index + 1}] ❌ Сетевая ошибка (Браузер заблокировал запрос):`, error.message);
                return null;
            }
        }
        return null;
    });

    const results = await Promise.all(tasks);
    return results.filter(url => url !== null);
}