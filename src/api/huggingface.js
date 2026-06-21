

export async function generateVideo(prompt, config) {
    const { count = 1, referenceImages = [] } = config;

    console.log("=== СТАРТ ГЕНЕРАЦИИ ВИДЕО (Krea AI через Прокси) ===");

    const proxyUrl = "/api/krea-proxy";
    const targetImage = referenceImages.length > 0 ? referenceImages[0] : null;

    const tasks = Array.from({ length: count }).map(async (_, index) => {
        try {
            if (index > 0) await new Promise(res => setTimeout(res, index * 1000));

            const response = await fetch(proxyUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: prompt || "Cinematic video, masterpiece, highly detailed, 8k",
                    image_url: targetImage,
                    frames: 30,
                    fps: 8
                }),
            });

            // Если прокси вернул ошибку
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error(`[Видео ${index + 1}] ❌ Полные детали ошибки от сервера:`, errData);
                throw new Error(errData.error || `Ошибка сервера: ${response.status}`);
            }

            const data = await response.json();
            console.log(`[Видео ${index + 1}] ✅ Ответ от Krea успешный:`, data);

            // Вытаскиваем ссылку на видео
            const videoUrl = data.url || data.uri || data.video_url;
            return videoUrl || null;

        } catch (error) {
            console.error(`[Видео ${index + 1}] ❌ Сбой генерации:`, error.message);
            return null;
        }
    });

    const results = await Promise.all(tasks);
    return results.filter(url => url !== null);
}