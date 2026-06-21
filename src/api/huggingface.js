// Проверь, как точно называется твой ключ от Gemini в файле .env
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;

export async function generateVideo(prompt, config) {
    const { count = 1, referenceImages = [] } = config;

    // Используем официальный код модели из документации
    const model = "veo-3.1-lite-generate-preview";

    console.log("=== СТАРТ ГЕНЕРАЦИИ ВИДЕО (Google Veo 3.1 Lite) ===");

    // Проверяем, есть ли картинка-референс
    let base64Image = null;
    let mimeType = null;

    if (referenceImages.length > 0) {
        const imgData = referenceImages[0];
        mimeType = imgData.substring(imgData.indexOf(':') + 1, imgData.indexOf(';'));
        base64Image = imgData.split(',')[1];
        console.log("📸 Обнаружен референс, режим: Image-to-Video!");
    } else {
        console.log("📝 Референса нет, режим: Text-to-Video!");
    }

    const tasks = Array.from({ length: count }).map(async (_, index) => {
        try {
            // Небольшая задержка, чтобы не бить в API одновременно
            if (index > 0) await new Promise(res => setTimeout(res, index * 2000));

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

            // Собираем запрос по стандартам Gemini
            const parts = [{ text: prompt || "Cinematic video, highly detailed, realistic" }];

            if (base64Image) {
                parts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Image
                    }
                });
            }

            console.log(`[Видео ${index + 1}] Отправляем запрос в Google...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: parts }],
                    generationConfig: {
                        temperature: 0.7 // Можно регулировать креативность
                    }
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error(`[Видео ${index + 1}] ❌ Ошибка Google API:`, errData);
                return null;
            }

            const data = await response.json();
            const candidate = data.candidates?.[0]?.content?.parts?.[0];
            let videoUrl = null;

            // Обрабатываем разные варианты того, как API может вернуть видео
            if (candidate?.inlineData) {
                // Если видео пришло в base64
                const byteCharacters = atob(candidate.inlineData.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: candidate.inlineData.mimeType || 'video/mp4' });
                videoUrl = URL.createObjectURL(blob);
            } else if (candidate?.fileData?.fileUri) {
                // Если вернулась прямая ссылка на файл в Google Cloud
                videoUrl = candidate.fileData.fileUri;
            } else if (candidate?.videoUri || candidate?.url) {
                videoUrl = candidate.videoUri || candidate.url;
            }

            if (!videoUrl) {
                console.error(`[Видео ${index + 1}] ❌ Не удалось извлечь видео из ответа. Структура:`, data);
                return null;
            }

            console.log(`[Видео ${index + 1}] 🎉 ГОТОВО! Видео успешно получено.`);
            return videoUrl;

        } catch (error) {
            console.error(`[Видео ${index + 1}] ❌ Сетевая ошибка браузера:`, error.message);
            return null;
        }
    });

    const results = await Promise.all(tasks);
    return results.filter(url => url !== null);
}