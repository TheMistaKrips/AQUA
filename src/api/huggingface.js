export async function generateVideo(prompt, config) {
    const { count = 1, referenceImages = [] } = config;

    console.log("=== СТАРТ ГЕНЕРАЦИИ ВИДЕО (Krea AI через Vercel Прокси) ===");

    // Наш локальный Vercel-эндпоинт (будет работать и на localhost, и на продакшене Vercel)
    const proxyUrl = "/api/krea-proxy";

    // Krea принимает картинку в поле image_url. Извлекаем первую картинку из рефов, если она есть
    const targetImage = referenceImages.length > 0 ? referenceImages[0] : null;

    const tasks = Array.from({ length: count }).map(async (_, index) => {
        try {
            // Делаем небольшую паузу между батчами
            if (index > 0) await new Promise(res => setTimeout(res, index * 1000));

            const response = await fetch(proxyUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: prompt || "Cinematic video, masterpiece, highly detailed, 8k",
                    image_url: targetImage, // Передаем картинку (Krea поддерживает base64 или URL)
                    frames: 30,
                    fps: 8
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Ошибка сервера со статусом: ${response.status}`);
            }

            const data = await response.json();
            console.log(`[Видео ${index + 1}] ✅ Задача на рендер успешно создана в Krea!`, data);

            // ⚠️ ВАЖНО: Krea AI возвращает ссылку на готовое видео не сразу, а через время!
            // Для беты мы сразу возвращаем финальную ссылку из ответа (например, data.uri или data.url)
            // Если Krea возвращает объект со статусом, вернем ссылку на видео файл:
            const videoUrl = data.url || data.uri || data.video_url;

            if (!videoUrl) {
                console.warn(`[Видео ${index + 1}] Krea приняла задачу, но не выдала прямую ссылку. Возвращаем ID задачи:`, data.id);
                // Если Krea возвращает асинхронный ID, используем временную заглушку или ID
                return null;
            }

            return videoUrl;

        } catch (error) {
            console.error(`[Видео ${index + 1}] ❌ Ошибка генерации:`, error.message);
            return null;
        }
    });

    const results = await Promise.all(tasks);
    // Фильтруем пустые результаты, чтобы сетка не ломалась
    return results.filter(url => url !== null);
}