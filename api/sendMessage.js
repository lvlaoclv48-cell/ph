import axios from 'axios';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Загружаем переменные окружения
let TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Для локальной разработки пытаемся загрузить из conf.env
if (!TELEGRAM_BOT_TOKEN) {
  try {
    // Пробуем загрузить через dotenv
    config({ path: join(process.cwd(), 'conf.env') });
    TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    
    // Если dotenv не сработал, читаем файл напрямую
    if (!TELEGRAM_BOT_TOKEN) {
      const envContent = readFileSync(join(process.cwd(), 'conf.env'), 'utf8');
      const tokenMatch = envContent.match(/TELEGRAM_BOT_TOKEN=(.+)/);
      if (tokenMatch) {
        TELEGRAM_BOT_TOKEN = tokenMatch[1].trim();
      }
    }
  } catch (error) {
    console.warn('Не удалось загрузить conf.env файл');
  }
}

// Проверяем токен
if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN не найден в переменных окружения');
}

async function sendTelegramMessage(chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка отправки в Telegram:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    throw error;
  }
}

export default async function handler(req, res) {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Обработка preflight запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Метод не поддерживается. Используйте POST.'
    });
  }

  try {
    const { text, id } = req.body;

    // Валидация входных данных
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Параметр "text" обязателен и не должен быть пустым'
      });
    }

    if (!id || typeof id !== 'string' || id.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Параметр "id" (chat_id) обязателен и не должен быть пустым'
      });
    }

    // Отправляем сообщение в Telegram
    const telegramResponse = await sendTelegramMessage(id, text);

    // Логируем успешную отправку (опционально)
    console.log(`Сообщение отправлено в чат ${id}: ${text.substring(0, 50)}...`);

    return res.status(200).json({
      success: true,
      message: 'Сообщение успешно отправлено',
      telegramResponse: telegramResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Ошибка обработки запроса:', error);

    // Определяем статус ошибки
    let statusCode = 500;
    let errorMessage = 'Внутренняя ошибка сервера';

    if (error.response) {
      // Ошибка от Telegram API
      statusCode = 400;
      errorMessage = `Ошибка Telegram API: ${error.response.data.description || error.message}`;
    } else if (error.request) {
      // Ошибка сети
      statusCode = 503;
      errorMessage = 'Не удалось подключиться к Telegram API';
    } else if (error.message.includes('TELEGRAM_BOT_TOKEN')) {
      // Ошибка конфигурации
      statusCode = 500;
      errorMessage = 'Ошибка конфигурации бота';
    }

    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Альтернативный экспорт для CommonJS (если нужно)
// module.exports = handler;
