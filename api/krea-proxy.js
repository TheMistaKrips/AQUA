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
        // === 1. СОЗДАНИЕ ЗАДАЧИ НА ВИДЕО ПО ФОТО И ТЕКСТУ (POST) ===
        if (req.method === 'POST') {
            const { prompt, image_url } = req.body;

            // Формируем payload для Krea Kling 3.0
            const payload = {
                prompt: prompt || "Animate this image, cinematic, high quality",
                aspect_ratio: "9:16"
            };

            // Если пользователь прикрепил картинку, добавляем её в запрос
            if (image_url) {
                payload.image_url = image_url;
            }

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

            return res.status(200).json(data); // Возвращает { job_id: "..." }
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