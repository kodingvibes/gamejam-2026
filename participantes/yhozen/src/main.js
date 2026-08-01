import './styles.css';

const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');
const pointer = { x: 0.5, y: 0.5 };

function resizeCanvas() {
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const { width, height } = canvas.getBoundingClientRect();

  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);
}

function updatePointer(event) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - bounds.left) / bounds.width;
  pointer.y = (event.clientY - bounds.top) / bounds.height;
}

function drawGrid(width, height, time) {
  const spacing = 48;
  const offset = (time * 12) % spacing;

  context.strokeStyle = 'rgba(132, 204, 255, 0.1)';
  context.lineWidth = 1;
  context.beginPath();

  for (let x = -spacing + offset; x < width + spacing; x += spacing) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }

  for (let y = -spacing + offset; y < height + spacing; y += spacing) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }

  context.stroke();
}

function drawBeacon(width, height, time) {
  const x = pointer.x * width;
  const y = pointer.y * height;
  const pulse = 30 + Math.sin(time * 4) * 6;
  const glow = context.createRadialGradient(x, y, 0, x, y, pulse * 3);

  glow.addColorStop(0, 'rgba(131, 255, 195, 0.9)');
  glow.addColorStop(0.25, 'rgba(85, 190, 255, 0.35)');
  glow.addColorStop(1, 'rgba(85, 190, 255, 0)');

  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, pulse * 3, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#d9fff0';
  context.beginPath();
  context.arc(x, y, 5, 0, Math.PI * 2);
  context.fill();
}

function render(timestamp) {
  const time = timestamp / 1000;
  const { width, height } = canvas.getBoundingClientRect();

  context.clearRect(0, 0, width, height);
  drawGrid(width, height, time);
  drawBeacon(width, height, time);
  window.requestAnimationFrame(render);
}

window.addEventListener('resize', resizeCanvas);
canvas.addEventListener('pointermove', updatePointer);
canvas.addEventListener('pointerdown', updatePointer);

resizeCanvas();
window.requestAnimationFrame(render);
