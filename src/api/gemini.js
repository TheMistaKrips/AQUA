import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// === 1. ГЕНЕРАТОР КАРТИНОК ===
export async function generateImages(prompt, config) {
    const { aspectRatio, model = "gemini-3-pro-image", referenceImages = [], count = 1 } = config;

    let finalPrompt = `${prompt}\n\nОбязательный формат изображения (Aspect Ratio): ${aspectRatio}.`;

    if (referenceImages.length > 0) {
        // ЖЕСТКАЯ инструкция для генератора отсекать фон референса
        finalPrompt += "\n⚠️ ВАЖНОЕ СИСТЕМНОЕ УКАЗАНИЕ: К запросу прикреплен референс. СТРОГО сохрани идентичность лица, брони и одежды персонажа. ЕСЛИ в тексте промпта указан белый фон (white background) — полностью ИГНОРИРУЙ фон на референсе и рисуй только на чистом белом фоне! Игнорируй пропорции референса, делай запрошенный Aspect Ratio.";
    }

    const contents = [finalPrompt];

    for (const img of referenceImages) {
        const base64Data = img.split(',')[1];
        const mimeType = img.substring(img.indexOf(':') + 1, img.indexOf(';'));
        contents.push({
            inlineData: { mimeType: mimeType, data: base64Data },
        });
    }

    const tasks = Array.from({ length: count }).map(async () => {
        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: contents,
                config: {
                    responseModalities: ["IMAGE"],
                    responseFormat: {
                        image: { aspectRatio: aspectRatio }
                    }
                }
            });

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:image/jpeg;base64,${part.inlineData.data}`;
                }
            }
        } catch (error) {
            console.error("Ошибка генерации:", error);
            return null;
        }
    });

    const results = await Promise.all(tasks);
    return results.filter(img => img !== null);
}

// === 2. ТЕКСТОВЫЙ АГЕНТ ===
export async function chatWithAgent(message, history, availableRefs, newAttachments = []) {
    const refsList = availableRefs.map(r => r.name).join(', ') || 'Пока нет загруженных референсов';

    const systemInstruction = `
Ты AQUA Агент — профессиональный AI-продюсер. Ты мультимодален и ВИДИШЬ картинки.

ДОСТУПНЫЕ БАЗОВЫЕ РЕФЕРЕНСЫ: [${refsList}].

⚠️ ПРАВИЛА ПОВЕДЕНИЯ:
1. ОТДЕЛЯЙ РАСКАДРОВКУ ОТ ПРЯМЫХ КОМАНД! Если пользователь дает прямую команду (например: "сгенерируй на белом фоне"), ПРИДУМАЙ НОВЫЙ ПРОМПТ С НУЛЯ!
2. БЕЛЫЙ ФОН (ИЗОЛЯЦИЯ): Если пользователь просит белый фон (даже если пишет "в стилистике проекта"), КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать в промпте про окружение (подземелья, туман, тени, liminal space). Описывай только стиль самого персонажа (Unreal Engine 5, 8k, hyper-realistic armor), а про фон СТРОГО пиши: "Pure clean white background, high key studio lighting, completely isolated character".
3. НАЗВАНИЯ: В поле "name" в JSON напиши понятное название.
4. ИСПОЛЬЗОВАНИЕ РЕФЕРЕНСОВ: Если просят использовать персонажа, возьми его точное имя из списка ДОСТУПНЫХ БАЗОВЫХ РЕФЕРЕНСОВ и вставь в массив "referenceNames".
5. В создаваемых промптах всегда требуй сохранять точную идентичность лиц из референсов.

ФОРМАТ JSON (ТОЛЬКО ДЛЯ ГЕНЕРАЦИИ):
{
  "readyToGenerate": true,
  "tasks": [
    {
      "name": "Название",
      "prompt": "Детальный Image Prompt...",
      "referenceNames": ["Имя из списка референсов"],
      "aspectRatio": "9:16",
      "count": 1
    }
  ]
}
`;

    try {
        let validContents = [];
        let lastRole = null;

        for (const msg of history) {
            const role = msg.role === 'agent' ? 'model' : 'user';
            if (role === lastRole) {
                validContents[validContents.length - 1].parts[0].text += `\n\n${msg.text}`;
            } else {
                validContents.push({ role: role, parts: [{ text: msg.text }] });
                lastRole = role;
            }
        }

        const currentParts = [{ text: message }];

        for (const img of newAttachments) {
            const base64Data = img.split(',')[1];
            const mimeType = img.substring(img.indexOf(':') + 1, img.indexOf(';'));
            currentParts.push({
                inlineData: { mimeType: mimeType, data: base64Data }
            });
        }

        if (lastRole === 'user') {
            validContents[validContents.length - 1].parts[0].text += `\n\n${message}`;
            validContents[validContents.length - 1].parts.push(...currentParts.slice(1));
        } else {
            validContents.push({ role: 'user', parts: currentParts });
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: validContents,
            config: {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                temperature: 0.7
            }
        });

        const reply = response.candidates[0].content.parts[0].text;

        let generationPlan = null;
        const startIdx = reply.indexOf('{');
        const endIdx = reply.lastIndexOf('}');

        if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
            const jsonStr = reply.substring(startIdx, endIdx + 1);
            try {
                generationPlan = JSON.parse(jsonStr);
            } catch (e) {
                console.error("Ошибка парсинга JSON от агента", e);
            }
        }

        return { text: reply, plan: generationPlan };

    } catch (error) {
        console.error("Ошибка Агента:", error);
        return { text: "Упс, ошибка связи с Агентом. Проверь консоль." };
    }
}