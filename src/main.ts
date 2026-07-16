const app = document.querySelector<HTMLDivElement>('#app');

if (app === null) {
  throw new Error('Missing #app root element.');
}

const main = document.createElement('main');
main.textContent = 'chronomap';

app.replaceChildren(main);
