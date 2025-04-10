const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT ||  3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const userAgents = JSON.parse(fs.readFileSync(path.join(__dirname, 'ua.json'), 'utf-8'))
  .map(item => item.userAgent);

const acceptLanguages = [
  'en-US,en;q=0.9',
  'en-GB,en;q=0.9',
  'de-DE,de;q=0.9,en;q=0.8',
  'ja-JP,ja;q=0.9',
  'pt-BR,pt;q=0.9',
  'hi-IN,hi;q=0.9'
];

const referers = [
  'https://www.google.com/',
  'https://www.bing.com/',
  'https://www.yahoo.com/',
  'https://duckduckgo.com/',
  'https://www.reddit.com/',
  'https://www.facebook.com/'
];

function getRandomHeader() {
  return {
    'Accept-Language': acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
    'Referer': referers[Math.floor(Math.random() * referers.length)],
    'X-Forwarded-For': generateRandomIp()
  };
}

function generateRandomIp() {
  const regions = [
    () => `104.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`, // US
    () => `5.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`, // Germany
    () => `110.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`, // Australia
    () => `180.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`, // Japan
    () => `186.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`, // Brazil
    () => `106.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` // India
  ];

  return regions[Math.floor(Math.random() * regions.length)]();
}

async function generateImage(prompt) {
  try {
    const headers = getRandomHeader();

    const response = await axios.post(
      'https://aliyun.zaiwen.top/draw/mj/imagine',
      {
        model_name: 'midjourney',
        prompt: prompt,
        ratio: '1:1',
        seed: Math.floor(Math.random() * 1000000000) // Random seed each time
      },
      {
        headers: {
          ...headers,
          'Origin': 'https://zaiwen.xueban.org.cn',
          'Connection': 'keep-alive'
        },
        timeout: 30000
      }
    );
    return response.data.info.task_id;
  } catch (error) {
    console.error('Error generating image:', error.response?.data || error.message);
    throw error;
  }
}

async function fetchImage(taskId) {
  try {
    const headers = getRandomHeader();

    const response = await axios.post(
      'https://aliyun.zaiwen.top/draw/mj/fetch',
      { task_id: taskId },
      {
        headers: headers,
        timeout: 30000
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching image:', error.response?.data || error.message);
    throw error;
  }
}

async function fetchUntilSuccess(taskId, retries = 60, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const imageData = await fetchImage(taskId);
      const status = imageData?.info?.status;

      if (status === 'SUCCESS') {
        return imageData;
      }

      console.log(`Status: ${status} (${i + 1}/${retries})... waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Image generation timed out or did not complete in time.');
}

app.get('/gen', async (req, res) => {
  try {
    const { prompt, api_key } = req.query;
    
    if (!prompt) {
      return res.status(400).json({ 
        success: false,
        error: 'Prompt is required' 
      });
    }

        // Validate API key
    const validApiKeys = ["xnil6x404x", "xnil6xxx"]; // Replace with your actual API keys
    if (!api_key || !validApiKeys.includes(api_key)) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid or missing API key' 
      });
    }

    const taskId = await generateImage(prompt);
    const imageData = await fetchUntilSuccess(taskId);

    res.json({
      success: true,
      task_id: taskId,
      image_data: imageData
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'API operation failed',
      details: error.response?.data || error.message
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
