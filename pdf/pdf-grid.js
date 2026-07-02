// Interactive Mouse Grid Animation — repel physics for the PDF tool template.
// Kept EXACTLY as the Stitch reference: spacing 30, baseRadius 1, maxRadius 3,
// mouse.radius 150, activeColor #630ed4. Shared by every generated pdf/<slug>.html.
// This is intentionally separate from the home screen's home-hub.js animation.
const canvas = document.getElementById('interactive-grid');
const ctx = canvas.getContext('2d');

let width, height;
const dots = [];
const mouse = { x: null, y: null, radius: 150 };

// Grid Configuration
const spacing = 30; // Distance between dots
const baseRadius = 1; // Base dot size
const maxRadius = 3; // Max dot size on hover
const baseColor = '#ccc3d8'; // outline-variant color roughly
const activeColor = '#630ed4'; // primary color

function initCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    createGrid();
}

class Dot {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.baseX = x;
        this.baseY = y;
        this.radius = baseRadius;
        this.color = baseColor;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }

    update() {
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        let forceDirectionX = dx / distance;
        let forceDirectionY = dy / distance;

        // Repel effect and size increase
        if (distance < mouse.radius) {
            let force = (mouse.radius - distance) / mouse.radius;
            let moveX = forceDirectionX * force * 5;
            let moveY = forceDirectionY * force * 5;

            this.x -= moveX;
            this.y -= moveY;
            this.radius = baseRadius + (maxRadius - baseRadius) * force;

            // Transition color based on force
            // Simplistic blend for demo: just switch to active if close enough, or interpolate
            if(force > 0.3) {
                this.color = activeColor;
            } else {
                this.color = baseColor;
            }
        } else {
            // Return to base position and state
            if (this.x !== this.baseX) {
                let dx = this.x - this.baseX;
                this.x -= dx / 10;
            }
            if (this.y !== this.baseY) {
                let dy = this.y - this.baseY;
                this.y -= dy / 10;
            }
            if(this.radius > baseRadius) {
                this.radius -= 0.1;
            }
            this.color = baseColor;
        }
        this.draw();
    }
}

function createGrid() {
    dots.length = 0;
    const cols = Math.floor(width / spacing);
    const rows = Math.floor(height / spacing);
    const offsetX = (width - cols * spacing) / 2;
    const offsetY = (height - rows * spacing) / 2;

    for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
            dots.push(new Dot(offsetX + i * spacing, offsetY + j * spacing));
        }
    }
}

function animate() {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < dots.length; i++) {
        dots[i].update();
    }
    requestAnimationFrame(animate);
}

// Event Listeners
window.addEventListener('resize', initCanvas);
window.addEventListener('mousemove', (e) => {
    mouse.x = e.x;
    mouse.y = e.y;
});
window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
});

// Initialize
initCanvas();
animate();
