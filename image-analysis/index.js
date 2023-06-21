'use strict';

const { get } = require('axios');

class Handler {
  constructor({ rekoSvc, translatorSvc }) {
    this.rekoSvc = rekoSvc;
    this.translatorSvc = translatorSvc;
  }

  async detectImageLabels(buffer) {
    const result = await this.rekoSvc
      .detectLabels({
        Image: {
          Bytes: buffer,
        },
      })
      .promise();

    const workingItems = result.Labels.filter(
      ({ Confidence }) => Confidence > 80,
    );

    const names = workingItems.map(({ Name }) => Name).join(' and ');

    return { workingItems, names };
  }

  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text,
    };

    const { TranslatedText } = await this.translatorSvc
      .translateText(params)
      .promise();

    return TranslatedText.split(' e ');
  }

  async getImageBuffer(imageUrl) {
    const response = await get(imageUrl, {
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data, 'base64');
    return buffer;
  }

  formatTextResults(texts, workingItems) {
    const finalText = [];

    console.log(texts, 'texts');

    for (const indexText in texts) {
      const nameInPortuguese = texts[indexText];

      const confidence = workingItems[indexText].Confidence;

      finalText.push(
        `${confidence.toFixed(2)}% de ser do tipo ${nameInPortuguese}`,
      );
    }
    return finalText.join('\n');
  }

  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters;

      console.log(imageUrl, 'imageUrl');

      console.log('downloading image...');
      const buffer = await this.getImageBuffer(imageUrl);

      const { workingItems, names } = await this.detectImageLabels(buffer);
      console.log('Translating to Portuguese...');

      const translatedNames = await this.translateText(names);

      console.log('handling final object...');

      const finalText = this.formatTextResults(translatedNames, workingItems);

      console.log('finishing...');

      return {
        statusCode: 200,
        body: 'A imagem tem\n'.concat(finalText),
      };
    } catch (error) {
      console.log('Error***', error.stack);
      return {
        statusCode: 500,
        body: 'Internal Server Error',
      };
    }
  }
}

// factory
const aws = require('aws-sdk');
const reko = new aws.Rekognition();
const translator = new aws.Translate();
const handler = new Handler({
  rekoSvc: reko,
  translatorSvc: translator,
});
module.exports.handler = handler.main.bind(handler);
