export async function generateVideo(prompt, config) {
    const { count = 1 } = config;
    const proxyUrl = "/api/hf-proxy";
    const model = "ByteDance/AnimateDiff-Lightning";

    console.log("=== СТАРТ ГЕНЕРАЦИИ ВИДЕО (HF через Vercel) ===");

    const tasks = Array.from({ length: count }).map(async (_, index) => {
        try {
            if (index > 0) await new Promise(res => setTimeout(res, index * 1500));

            const finalPrompt = prompt.trim() ? prompt : "Cinematic shot, masterpiece, highly detailed";
            const payload = { inputs: finalPrompt };

            let attempts = 0;
            const maxAttempts = 15;

            while (attempts < maxAttempts) {
                attempts++;
                console.log(`[Видео ${index + 1}] Попытка ${attempts}/${maxAttempts}...`);

                const response = await fetch(proxyUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model, payload }),
                });

                // Если модель спит (Vercel пробросил нам 503)
                if (response.status === 503) {
                    console.log(`[Видео ${index + 1}] Модель HF просыпается. Ждем 5 сек...`);
                    await new Promise(res => setTimeout(res, 5000));
                    continue;
                }

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    console.error(`[Видео ${index + 1}] ❌ Ошибка HF:`, errData);
                    return null;
                }

                // Успех! Получаем бинарник и делаем ссылку
                const blob = await response.blob();
                console.log(`[Видео ${index + 1}] ✅ ГОТОВО! Видео получено.`);
                return URL.createObjectURL(blob);
            }

            console.error(`[Видео ${index + 1}] ❌ Превышено время ожидания пробуждения модели.`);
            return null;

        } catch (error) {
            console.error(`[Видео ${index + 1}] ❌ Сетевая ошибка фронтенда:`, error.message);
            return null;
        }
    });

    const results = await Promise.all(tasks);
    return results.filter(url => url !== null);
}