import https from 'https';

export const maxDuration = 60; // Даем функции жить до 60 секунд

export default function handler(req, res) {
    // 1. Настройки CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });

    const HF_TOKEN = process.env.VITE_HF_API_KEY;
    if (!HF_TOKEN) return res.status(500).json({ error: 'Ключ VITE_HF_API_KEY не найден!' });

    const { model, payload } = req.body;

    // 2. Параметры низкоуровневого запроса
    const options = {
        hostname: 'api-inference.huggingface.co',
        path: `/models/${model}`,
        method: 'POST',
        family: 4, // ⚠️ ГЛАВНАЯ МАГИЯ: Принудительно используем IPv4! Обходит баг Vercel
        headers: {
            'Authorization': `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
            'x-wait-for-model': 'true' // Просим HF дождаться рендера видео
        }
    };

    // 3. Открываем системный HTTPS запрос
    const request = https.request(options, (hfRes) => {

        // Передаем статус от нейросети прямо в React
        res.status(hfRes.statusCode);

        // Прокидываем заголовки (это скажет браузеру, что летит именно video/mp4)
        for (const key in hfRes.headers) {
            res.setHeader(key, hfRes.headers[key]);
        }

        // 🚀 Стримим результат напрямую! Vercel больше не разорвет пакет из-за перевеса.
        hfRes.pipe(res);
    });

    // 4. Отлов реальных системных ошибок сети
    request.on('error', (e) => {
        res.status(500).json({
            error: 'Низкоуровневый сбой сети Vercel',
            details: e.message // Теперь тут будет написана настоящая причина (ECONNRESET, ETIMEDOUT и т.д.)
        });
    });

    // Отправляем наш текст в нейросеть
    request.write(JSON.stringify(payload));
    request.end();
}