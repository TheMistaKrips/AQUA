export default async function handler(req, res) {
    // Настройки CORS заголовков
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') return res.status(200).end();

    const KREA_API_KEY = process.env.VITE_KREA_API_KEY;

    if (!KREA_API_KEY) {
        return res.status(500).json({ error: 'Ключ VITE_KREA_API_KEY не настроен в панели Vercel!' });
    }

    try {
        // === 1. СОЗДАНИЕ ЗАДАЧИ НА ВИДЕО (POST) ===
        if (req.method === 'POST') {
            const { prompt, image_url } = req.body;
            let finalImageUrl = null;

            // Если прилетел Base64, загружаем его на сервера Krea
            if (image_url && image_url.startsWith('data:')) {
                console.log("Конвертируем Base64 и загружаем на Krea...");

                try {
                    // Вытаскиваем чистый base64 и mimeType
                    const mimeType = image_url.substring(image_url.indexOf(':') + 1, image_url.indexOf(';'));
                    const base64Data = image_url.split(',')[1];
                    const buffer = Buffer.from(base64Data, 'base64');

                    // Собираем FormData для отправки файла на Krea
                    const formData = new FormData();
                    const fileBlob = new Blob([buffer], { type: mimeType });
                    formData.append('file', fileBlob, `input_frame.${mimeType.split('/')[1]}`);

                    const uploadResponse = await fetch('https://api.krea.ai/v1/upload', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${KREA_API_KEY}`
                        },
                        body: formData
                    });

                    if (!uploadResponse.ok) {
                        const uploadErr = await uploadResponse.text();
                        throw new Error(`Не удалось загрузить картинку на сервер Krea: ${uploadErr}`);
                    }

                    const uploadData = await uploadResponse.json();
                    // Перехватываем публичный URL, который выдала Krea
                    finalImageUrl = uploadData.url || uploadData.uri;
                    console.log("Картинка успешно залита на Krea, ссылка:", finalImageUrl);

                } catch (uploadError) {
                    return res.status(400).json({
                        error: 'Ошибка предварительной загрузки изображения',
                        details: uploadError.message
                    });
                }
            } else if (image_url) {
                // Если прилетела обычная ссылка, оставляем как есть
                finalImageUrl = image_url;
            }

            // Формируем финальный payload для Kling 3.0
            const payload = {
                prompt: prompt || "Animate this image, cinematic, high quality",
                aspect_ratio: "9:16"
            };

            if (finalImageUrl) {
                payload.image_url = finalImageUrl;
            }

            console.log("Отправляем итоговый запрос в Kling 3.0...");
            const kreaResponse = await fetch('https://api.krea.ai/generate/video/kling/kling-3.0', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${KREA_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const contentType = kreaResponse.headers.get('content-type') || '';
            const data = contentType.includes('application/json') ? await kreaResponse.json() : await kreaResponse.text();

            if (!kreaResponse.ok) {
                return res.status(kreaResponse.status).json({ error: 'Krea отклонила старт задачи', details: data });
            }

            return res.status(200).json(data);
        }

        // === 2. ПРОВЕРКА СТАТУСА (GET) ===
        if (req.method === 'GET') {
            const { job_id } = req.query;
            if (!job_id) return res.status(400).json({ error: 'Пропущен job_id' });

            const kreaResponse = await fetch(`https://api.krea.ai/jobs/${job_id}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${KREA_API_KEY}` }
            });

            const contentType = kreaResponse.headers.get('content-type') || '';
            const data = contentType.includes('application/json') ? await kreaResponse.json() : await kreaResponse.text();

            if (!kreaResponse.ok) {
                return res.status(kreaResponse.status).json({ error: 'Ошибка проверки статуса', details: data });
            }

            return res.status(200).json(data);
        }

        return res.status(405).json({ error: 'Метод не поддерживается' });

    } catch (error) {
        return res.status(500).json({ error: 'Внутренний сбой прокси сервера', details: error.message });
    }
}