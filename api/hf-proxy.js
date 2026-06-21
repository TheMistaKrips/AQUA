export default async function handler(req, res) {
    // Настройки CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });

    const HF_TOKEN = process.env.VITE_HF_API_KEY;
    if (!HF_TOKEN) return res.status(500).json({ error: 'Ключ VITE_HF_API_KEY не найден на Vercel!' });

    const { model, payload } = req.body;

    try {
        const hfResponse = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_TOKEN}`,
                'Content-Type': 'application/json',
                // Заставляем HF не сбрасывать соединение, а честно ждать конца генерации
                'x-wait-for-model': 'true'
            },
            body: JSON.stringify(payload)
        });

        if (hfResponse.status === 503) {
            return res.status(503).json({ error: 'Модель загружается', status: 503 });
        }

        if (!hfResponse.ok) {
            const errText = await hfResponse.text();
            return res.status(hfResponse.status).json({ error: errText });
        }

        const contentType = hfResponse.headers.get('content-type');

        // Если HF прислал JSON с ошибкой вместо видео (такое бывает)
        if (contentType && contentType.includes('application/json')) {
            const jsonResponse = await hfResponse.json();
            return res.status(400).json({ error: 'HF вернул текст/ошибку вместо видео', details: jsonResponse });
        }

        // Забираем бинарник видео
        const arrayBuffer = await hfResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Прокидываем видео прямо в React
        res.setHeader('Content-Type', contentType || 'video/mp4');
        return res.status(200).send(buffer);

    } catch (error) {
        // Теперь, если соединение отвалится, мы увидим реальную причину
        return res.status(500).json({ error: 'Сбой сети между Vercel и HF', details: error.message });
    }
}