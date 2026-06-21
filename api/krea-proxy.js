export default async function handler(req, res) {
    // Настройки CORS
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
        return res.status(500).json({ error: 'Ключ VITE_KREA_API_KEY не настроен на Vercel!' });
    }

    try {
        // === 1. СОЗДАНИЕ ЗАДАЧИ НА ВИДЕО (POST) ===
        if (req.method === 'POST') {
            const { prompt, image_url } = req.body;
            let finalImageUrl = null;

            // Если прилетел Base64, грузим его на лояльный хостинг tmpfiles.org
            if (image_url && image_url.startsWith('data:')) {
                console.log("📸 Обнаружен Base64. Загружаем на tmpfiles.org...");

                try {
                    const mimeType = image_url.substring(image_url.indexOf(':') + 1, image_url.indexOf(';'));
                    const base64Data = image_url.split(',')[1];
                    const buffer = Buffer.from(base64Data, 'base64');

                    // Формируем файл
                    const formData = new FormData();
                    const fileBlob = new Blob([buffer], { type: mimeType });
                    formData.append('file', fileBlob, `image.${mimeType.split('/')[1]}`);

                    const uploadResponse = await fetch('https://tmpfiles.org/api/v1/upload', {
                        method: 'POST',
                        body: formData
                    });

                    if (!uploadResponse.ok) {
                        throw new Error(`Tmpfiles отклонил файл. Статус: ${uploadResponse.status}`);
                    }

                    const uploadData = await uploadResponse.json();

                    // Tmpfiles возвращает ссылку вида https://tmpfiles.org/12345/image.png
                    // Чтобы нейросеть могла скачать файл напрямую, нужно добавить /dl/
                    finalImageUrl = uploadData.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
                    console.log("✅ Картинка загружена! Прямая ссылка для нейросети:", finalImageUrl);

                } catch (uploadError) {
                    return res.status(400).json({
                        error: 'Ошибка загрузки референса на промежуточный сервер',
                        details: uploadError.message
                    });
                }
            } else if (image_url) {
                finalImageUrl = image_url;
            }

            // Формируем payload для Krea Kling 3.0
            const payload = {
                prompt: prompt || "Animate this image, cinematic, high quality",
                aspect_ratio: "9:16"
            };

            if (finalImageUrl) {
                payload.image_url = finalImageUrl;
            }

            console.log("🚀 Отправляем прямую ссылку в Krea Kling 3.0...");
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
                return res.status(kreaResponse.status).json({ error: 'Krea отклонила задачу', details: data });
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