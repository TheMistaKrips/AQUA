export async function generateVideo(prompt, config) {
    const { count = 1, referenceImages = [] } = config;
    const proxyUrl = "/api/krea-proxy";

    console.log("=== СТАРТ ИНТЕГРИРОВАННОЙ ГЕНЕРАЦИИ (Krea Kling 3.0 Image-to-Video) ===");

    // Вытаскиваем картинку-референс, если она загружена в инпут
    const targetImage = referenceImages.length > 0 ? referenceImages[0] : null;
    if (targetImage) {
        console.log(`📸 Картинка-референс обнаружена! Отправляем на анимацию...`);
    } else {
        console.log(`📝 Картинка не найдена. Работаем в режиме Text-to-Video.`);
    }

    const tasks = Array.from({ length: count }).map(async (_, index) => {
        try {
            if (index > 0) await new Promise(res => setTimeout(res, index * 1500));

            // ШАГ 1: Отправляем запрос на создание видео
            const response = await fetch(proxyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: prompt,
                    image_url: targetImage // Передаем картинку (Krea поддерживает base64 Data URI)
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error(`[Видео ${index + 1}] ❌ Не удалось создать задачу:`, errData);
                return null;
            }

            const data = await response.json();
            const jobId = data.job_id || data.id;

            if (!jobId) {
                console.error(`[Видео ${index + 1}] ❌ Сервер не выдал ID задачи:`, data);
                return null;
            }

            console.log(`[Видео ${index + 1}] ⏳ Рендер запущен успешно! ID: ${jobId}. Проверяем статус...`);

            // ШАГ 2: Цикл ожидания видео (Polling)
            for (let attempt = 1; attempt <= 40; attempt++) {
                await new Promise(res => setTimeout(res, 10000)); // Опрос каждые 10 секунд

                const statusRes = await fetch(`${proxyUrl}?job_id=${jobId}`, { method: "GET" });
                if (!statusRes.ok) continue;

                const statusData = await statusRes.json();
                console.log(`[Видео ${index + 1}] Статус рендера (${attempt}/40): ${statusData.status}`);

                if (statusData.status === "completed" || statusData.status === "done") {
                    const videoUrl = statusData.result?.urls?.[0] || statusData.result?.url || statusData.url;
                    console.log(`[Видео ${index + 1}] 🎉 ВИДЕО ПРИЛЕТЕЛО! Ссылка:`, videoUrl);
                    return videoUrl;
                }

                if (statusData.status === "failed" || statusData.status === "error" || statusData.status === "cancelled") {
                    console.error(`[Видео ${index + 1}] ❌ Сбой на стороне нейросети Krea.`);
                    return null;
                }
            }

            console.error(`[Видео ${index + 1}] ❌ Время ожидания рендера истекло.`);
            return null;

        } catch (error) {
            console.error(`[Видео ${index + 1}] ❌ Ошибка пайплайна:`, error.message);
            return null;
        }
    });

    const results = await Promise.all(tasks);
    return results.filter(url => url !== null);
}