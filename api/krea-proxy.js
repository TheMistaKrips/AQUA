export default async function handler(req, res) {
    // Настройки CORS заголовков, чтобы браузер не ругался
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    // Обработка предварительного запроса браузера (Preflight OPTIONS request)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Допускаются только POST-запросы' });
    }

    // Получаем ключ, сохраненный в админке Vercel
    const KREA_API_KEY = process.env.VITE_KREA_API_KEY;

    if (!KREA_API_KEY) {
        return res.status(500).json({ error: 'Ошибка сервера: Ключ KREA_API_KEY не настроен в Vercel!' });
    }

    try {
        // Отправляем чистый запрос на официальный сервер Krea от лица серверов Vercel
        const kreaResponse = await fetch('https://api.krea.ai/v1/video-generation', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${KREA_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body), // Пересылаем промпт и настройки из React
        });

        const data = await kreaResponse.json();

        if (!kreaResponse.ok) {
            console.error('Ошибка от Krea API:', data);
            return res.status(kreaResponse.status).json(data);
        }

        // Возвращаем результат во фронтенд
        return res.status(200).json(data);

    } catch (error) {
        console.error('Критический сбой прокси сервера:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка прокси-сервера', details: error.message });
    }
}