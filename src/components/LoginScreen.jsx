import React, { useState } from 'react';
import keysData from '../data/keys.json';
import aquaLogo from '../assets/AQUA.png';
import '../styles/LoginScreen.css';

export default function LoginScreen({ onLogin }) {
    const [inputKey, setInputKey] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        const cleanKey = inputKey.trim();

        // Проверяем, есть ли введенный ключ в нашем JSON-файле
        if (keysData.validKeys.includes(cleanKey)) {
            // Если есть — сохраняем в кэш браузера навсегда и пускаем в приложение
            localStorage.setItem('aqua_access_key', cleanKey);
            onLogin();
        } else {
            // Если нет — трясем инпут и выдаем ошибку
            setError(true);
            setInputKey('');
        }
    };

    return (
        <div className="login-container">
            <div className="login-panel glass-panel">
                <img src={aquaLogo} alt="AQUA Logo" className="login-logo" />
                <h2>Доступ закрыт</h2>
                <p>Введите ваш персональный ключ для входа в систему</p>

                <form onSubmit={handleSubmit} className="login-form">
                    <input
                        type="text"
                        placeholder="Ваш ключ доступа..."
                        value={inputKey}
                        onChange={(e) => { setInputKey(e.target.value); setError(false); }}
                        className={error ? 'error-shake' : ''}
                        autoFocus
                    />
                    {error && <span className="error-text">Неверный ключ доступа!</span>}

                    <button type="submit" className="login-btn">Войти</button>
                </form>
            </div>
        </div>
    );
}