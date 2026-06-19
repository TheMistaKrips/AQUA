import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export async function generateImages(prompt, config) {
    const { aspectRatio, model = "gemini-3-pro-image", referenceImages = [], count = 1 } = config;

    let finalPrompt = `${prompt}\n\nОбязательный формат изображения (Aspect Ratio): ${aspectRatio}.`;

    if (referenceImages.length > 0) {
        finalPrompt += "\n⚠️ ВАЖНОЕ СИСТЕМНОЕ УКАЗАНИЕ: К этому запросу прикреплены изображения-референсы. Перенеси объекты, стиль или композицию с прикрепленных файлов на итоговый результат, НО СТРОГО сгенерируй картинку в указанном формате, игнорируя пропорции исходника.";
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

export async function chatWithAgent(message, history, availableRefs, newAttachments = []) {
    const refsList = availableRefs.map(r => r.name).join(', ') || 'Пока нет загруженных референсов';

    const systemInstruction = `
Ты AQUA Агент — профессиональный AI-продюсер и помощник арт-директора. Ты мультимодален и ВИДИШЬ картинки, которые прикрепляет пользователь.

ДОСТУПНЫЕ БАЗОВЫЕ РЕФЕРЕНСЫ: [${refsList}].

⚠️ ПРАВИЛА ПОВЕДЕНИЯ (ЧИТАЙ И ИСПОЛНЯЙ ЖЕСТКО!):
1. РАЗДЕЛЯЙ БЕСЕДУ И ГЕНЕРАЦИЮ! Если пользователь просто кидает картинки, дает им имена или задает вопросы — ПРОСТО ОТВЕЧАЙ ТЕКСТОМ. Подтверди, что ты увидел. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО ВЫДАВАТЬ JSON БЛОК В ЭТОМ СЛУЧАЕ!
2. ВЫДАВАЙ JSON ТОЛЬКО если пользователь ПРЯМО ПРИКАЗАЛ сгенерировать/нарисовать/сделать картинку.
3. ЗАПОМИНАНИЕ ИМЕН: Если пользователь пишет "фотка 1 - это Графиня", ты должен навсегда запомнить: Графиня = "Вложение 1".
4. ИСПОЛЬЗОВАНИЕ РЕФЕРЕНСОВ В JSON: В массиве "referenceNames" пиши СТРОГО системное имя (например, "Вложение 1").
5. ПРОМПТЫ: Пиши сочные Image Prompts на английском (Unreal Engine 5, 8k, photorealistic). В промпте ВСЕГДА пиши команду: "Strictly match the facial features, likeness, and clothing from the provided reference image. Do not stylize."

ФОРМАТ JSON (ИСПОЛЬЗУЙ ТОЛЬКО ДЛЯ КОМАНД ГЕНЕРАЦИИ!):
{
  "readyToGenerate": true,
  "tasks": [
    {
      "prompt": "Детальный английский Image Prompt...",
      "referenceNames": ["Вложение 1"],
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