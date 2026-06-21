export default async function handler(req, res) {
    // Настройки CORS заголовков
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Допускаются только POST-запросы' });
    }

    const KREA_API_KEY = process.env.VITE_KREA_API_KEY;

    if (!KREA_API_KEY) {
        return res.status(500).json({ error: 'Ключ VITE_KREA_API_KEY не найден в Environment Variables на Vercel!' });
    }

    try {
        const kreaResponse = await fetch('https://api.krea.ai/v1/video-generation', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${KREA_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body),
        });

        // Проверяем тип контента от Krea
        const contentType = kreaResponse.headers.get('content-type') || '';
        let responseData;

        if (contentType.includes('application/json')) {
            responseData = await kreaResponse.json();
        } else {
            // Если Krea вернула HTML-ошибку или текст, забираем как строку
            responseData = { rawText: await kreaResponse.text() };
        }

        // Если Krea вернула статус ошибки (например, 400 или 413)
        if (!kreaResponse.ok) {
            return res.status(kreaResponse.status).json({
                error: 'Ошибка от Krea API',
                status: kreaResponse.status,
                details: responseData
            });
        }

        // Если всё супер
        return res.status(200).json(responseData);

    } catch (error) {
        return res.status(500).json({
            error: 'Критический сбой прокси-сервера Vercel',
            details: error.message
        });
    }
}