const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const templateDesigns = {
  default: {
    name: 'Professional Default',
    preview: 'Clean and professional design with minimal styling',
    generate: (subject, body, senderName) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333;">
        <div style="border-bottom: 2px solid #007bff; padding-bottom: 15px; margin-bottom: 25px;">
          <h2 style="color: #007bff; margin: 0;">${subject}</h2>
        </div>
        <div style="margin-bottom: 30px;">
          ${body}
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
          Best regards,<br>
          <strong>${senderName}</strong>
        </div>
      </div>
    `
  },
  newyear: {
    name: 'New Year',
    preview: 'Celebratory New Year greeting with fireworks',
    generate: (subject, body, senderName) => `
      <div style="font-family: 'Montserrat', 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 30px 20px; background: #0a0a2a; position: relative; overflow: hidden; min-height: 600px;">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');
          
          .greeting-card {
            position: relative;
            z-index: 10;
            background: rgba(10, 10, 42, 0.7);
            backdrop-filter: blur(8px);
            border-radius: 16px;
            padding: 30px;
            border: 1px solid rgba(255, 215, 0, 0.3);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            text-align: center;
          }
          
          .year {
            font-family: 'Dancing Script', cursive;
            font-size: 4rem;
            background: linear-gradient(to right, #ffd700, #ff8c00, #ff4500);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            margin: 0 0 10px 0;
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
          }
          
          .title {
            font-size: 2.2rem;
            font-weight: 700;
            color: #fff;
            margin: 0 0 20px 0;
            letter-spacing: 1px;
          }
          
          .message {
            font-size: 1.1rem;
            color: #e6e6ff;
            line-height: 1.6;
            margin-bottom: 25px;
          }
          
          .signature {
            font-size: 1rem;
            color: #ffd700;
            font-weight: 600;
          }
          
          .fireworks-count {
            position: absolute;
            bottom: 20px;
            right: 20px;
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.9rem;
            z-index: 10;
          }
        </style>
        
        <canvas id="newyearFireworks" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none;"></canvas>
        
        <script>
          (function() {
            const canvas = document.getElementById('newyearFireworks');
            const ctx = canvas.getContext('2d');
            let fireworksCount = 0;

            function resizeCanvas() {
              canvas.width = canvas.offsetWidth;
              canvas.height = canvas.offsetHeight;
            }
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);

            class Particle {
              constructor(x, y, color) {
                this.x = x;
                this.y = y;
                this.radius = Math.random() * 2 + 1;
                this.color = color;
                this.angle = Math.random() * 2 * Math.PI;
                this.speed = Math.random() * 4 + 2;
                this.life = 100;
                this.gravity = 0.1;
                this.friction = 0.96;
                this.alpha = 1;
                this.trail = [];
                this.maxTrailLength = 5;
              }
              
              update() {
                this.trail.push({x: this.x, y: this.y});
                if (this.trail.length > this.maxTrailLength) this.trail.shift();
                
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed + this.gravity;
                this.speed *= this.friction;
                this.life--;
                this.alpha = this.life / 100;
              }
              
              draw() {
                ctx.save();
                for (let i = 0; i < this.trail.length; i++) {
                  const point = this.trail[i];
                  const trailAlpha = this.alpha * (i / this.trail.length);
                  ctx.globalAlpha = trailAlpha * 0.5;
                  ctx.beginPath();
                  ctx.arc(point.x, point.y, this.radius * 0.7, 0, Math.PI * 2);
                  ctx.fillStyle = this.color;
                  ctx.fill();
                }
                
                ctx.globalAlpha = this.alpha;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
                ctx.restore();
              }
            }

            class Firework {
              constructor(x, y, targetX, targetY) {
                this.x = x;
                this.y = y;
                this.targetX = targetX;
                this.targetY = targetY;
                this.speed = 8;
                this.angle = Math.atan2(targetY - y, targetX - x);
                this.distance = Math.hypot(targetX - x, targetY - y);
                this.traveled = 0;
                this.color = this.getRandomColor();
                this.trail = [];
                this.exploded = false;
                this.particles = [];
              }
              
              getRandomColor() {
                const colors = ['#FF5252', '#FF4081', '#E040FB', '#7C4DFF', '#536DFE', '#448AFF', '#40C4FF', '#18FFFF', '#64FFDA', '#69F0AE', '#B2FF59', '#EEFF41', '#FFFF00', '#FFD740', '#FFAB40', '#FF6E40'];
                return colors[Math.floor(Math.random() * colors.length)];
              }
              
              update() {
                if (!this.exploded) {
                  this.trail.push({x: this.x, y: this.y});
                  if (this.trail.length > 8) this.trail.shift();
                  
                  const vx = Math.cos(this.angle) * this.speed;
                  const vy = Math.sin(this.angle) * this.speed;
                  
                  this.x += vx;
                  this.y += vy;
                  this.traveled += this.speed;
                  
                  if (this.traveled >= this.distance) this.explode();
                } else {
                  this.particles.forEach((p, i) => {
                    p.update();
                    if (p.life <= 0) this.particles.splice(i, 1);
                  });
                }
              }
              
              draw() {
                if (!this.exploded) {
                  ctx.save();
                  for (let i = 0; i < this.trail.length; i++) {
                    const point = this.trail[i];
                    const trailAlpha = i / this.trail.length;
                    ctx.globalAlpha = trailAlpha;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
                    ctx.fillStyle = this.color;
                    ctx.fill();
                  }
                  
                  ctx.globalAlpha = 1;
                  ctx.beginPath();
                  ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
                  ctx.fillStyle = this.color;
                  ctx.fill();
                  ctx.restore();
                } else {
                  this.particles.forEach(p => p.draw());
                }
              }
              
              explode() {
                this.exploded = true;
                fireworksCount++;
                document.getElementById('fireworksCount')?.textContent = fireworksCount;
                
                const particleCount = Math.random() * 80 + 120;
                for (let i = 0; i < particleCount; i++) {
                  this.particles.push(new Particle(this.x, this.y, this.color));
                }
              }
            }

            let fireworks = [];

            function createFirework() {
              const x = Math.random() * canvas.width;
              const y = canvas.height;
              const targetX = Math.random() * canvas.width;
              const targetY = Math.random() * (canvas.height * 0.6);
              
              fireworks.push(new Firework(x, y, targetX, targetY));
            }

            function drawStars() {
              for (let i = 0; i < 100; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const radius = Math.random() * 1.2;
                const alpha = Math.random() * 0.7 + 0.3;
                
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = '#FFFFFF';
                ctx.fill();
                ctx.restore();
              }
            }

            function drawBackground() {
              const gradient = ctx.createRadialGradient(
                canvas.width / 2, canvas.height / 2, 50,
                canvas.width / 2, canvas.height / 2, canvas.width
              );
              gradient.addColorStop(0, '#0a0a2a');
              gradient.addColorStop(1, '#000015');
              
              ctx.fillStyle = gradient;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            function animate() {
              drawBackground();
              drawStars();

              fireworks.forEach((fw, i) => {
                fw.update();
                fw.draw();
                
                if (fw.exploded && fw.particles.length === 0) {
                  fireworks.splice(i, 1);
                }
              });
              
              requestAnimationFrame(animate);
            }

            setInterval(createFirework, 800);
            for (let i = 0; i < 3; i++) {
              setTimeout(() => createFirework(), i * 300);
            }
            animate();
          })();
        </script>
        
        <div class="greeting-card">
          <h1 class="year">2025</h1>
          <h2 class="title">${subject}</h2>
          <p class="message">${body}</p>
          <p class="signature">With warm wishes,<br>${senderName}</p>
        </div>
        
        <div class="fireworks-count">Fireworks launched: <span id="fireworksCount">0</span></div>
      </div>
    `
  },
  elegant: {
    name: 'Elegant Minimalist',
    preview: 'Sophisticated design with subtle gradients and modern typography',
    generate: (subject, body, senderName) => `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 40px 20px;">
        <div style="background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 300;">${subject}</h1>
          </div>
          <div style="padding: 40px; line-height: 1.8; color: #444;">
            ${body}
          </div>
          <div style="padding: 20px 40px; background: #f8f9fa; border-top: 1px solid #e9ecef; font-style: italic; color: #6c757d;">
            Warm regards,<br>
            <span style="color: #495057; font-weight: 500;">${senderName}</span>
          </div>
        </div>
      </div>
    `
  },
  modern: {
    name: 'Modern Corporate',
    preview: 'Bold, contemporary design with geometric elements',
    generate: (subject, body, senderName) => `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(90deg, #ff6b6b, #ffd93d, #6bcf7f, #4ecdc4, #45b7d1); height: 5px;"></div>
        <div style="padding: 40px;">
          <div style="background: #2d2d2d; margin: -20px -20px 30px -20px; padding: 30px 20px; border-radius: 0 0 20px 20px;">
            <h1 style="color: #45b7d1; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">${subject}</h1>
          </div>
          <div style="line-height: 1.7; color: #e0e0e0;">
            ${body}
          </div>
          <div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #45b7d1; text-align: center;">
            <div style="color: #45b7d1; font-size: 18px; font-weight: bold;">${senderName}</div>
          </div>
        </div>
      </div>
    `
  },
  vibrant: {
    name: 'Vibrant & Colorful',
    preview: 'Eye-catching design with vibrant colors and playful elements',
    generate: (subject, body, senderName) => `
      <div style="font-family: 'Comic Sans MS', cursive, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(45deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%); padding: 20px; border-radius: 20px;">
        <div style="background: white; border-radius: 20px; padding: 0; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; position: relative;">
            <div style="position: absolute; top: 10px; right: 20px; width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 50%;"></div>
            <div style="position: absolute; bottom: 10px; left: 20px; width: 30px; height: 30px; background: rgba(255,255,255,0.3); border-radius: 50%;"></div>
            <h1 style="color: white; margin: 0; font-size: 22px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${subject}</h1>
          </div>
          <div style="padding: 30px; line-height: 1.6; color: #333; font-size: 16px;">
            ${body}
          </div>
          <div style="background: linear-gradient(90deg, #ff6b6b, #ffd93d, #6bcf7f); padding: 20px; text-align: center; color: white; font-weight: bold; font-size: 16px;">
            ${senderName}
          </div>
        </div>
      </div>
    `
  },
  luxury: {
    name: 'Luxury Premium',
    preview: 'Premium design with gold accents and sophisticated styling',
    generate: (subject, body, senderName) => `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; background: #0f0f0f; color: #e8e8e8; border: 2px solid #d4af37; border-radius: 8px;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border-bottom: 3px solid #d4af37; padding: 30px; text-align: center;">
          <div style="border: 1px solid #d4af37; padding: 20px; border-radius: 5px; display: inline-block;">
            <h1 style="color: #d4af37; margin: 0; font-size: 24px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">${subject}</h1>
          </div>
        </div>
        <div style="padding: 40px; line-height: 1.8; font-size: 16px;">
          ${body}
        </div>
        <div style="background: linear-gradient(135deg, '1a1a1a' 0%, '2d2d2d' 100%); border-top: 3px solid #d4af37; padding: 25px; text-align: center;">
          <div style="color: #d4af37; font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">
            ${senderName}
          </div>
          <div style="color: #888; font-size: 12px; margin-top: 5px; font-style: italic;">
            Premium Service Excellence
          </div>
        </div>
      </div>
    `
  },
  annualReview: { 
    name: 'Life Insurance Review',
    preview: 'Clean life insurance policy review with life changes checklist',
    generate: (subject, body, senderName, ctaText = 'Schedule Policy Review', ctaLink = '#') => `
      <div style="font-family: 'Inter', 'Montserrat', sans-serif; max-width: 600px; margin: 0 auto; padding: 30px 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          .review-card {
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.08);
            position: relative;
          }
          
          .card-header {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            padding: 40px 30px;
            position: relative;
            overflow: hidden;
          }
          
          .header-title {
            color: #ffffff;
            margin: 0 0 8px 0;
            font-size: 24px;
            font-weight: 700;
            position: relative;
            z-index: 2;
          }
          
          .header-subtitle {
            color: rgba(255, 255, 255, 0.9);
            margin: 0;
            font-size: 16px;
            font-weight: 400;
            position: relative;
            z-index: 2;
          }
          
          .floating-shape {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            animation: float 6s ease-in-out infinite;
          }
          
          .shape-1 {
            top: 20px;
            right: 30px;
            width: 60px;
            height: 60px;
            animation-delay: 0s;
          }
          
          .shape-2 {
            bottom: -15px;
            left: -15px;
            width: 80px;
            height: 80px;
            animation-delay: 2s;
          }
          
          @keyframes float {
            0%, 100% {
              transform: translateY(0) scale(1);
            }
            50% {
              transform: translateY(-10px) scale(1.05);
            }
          }
          
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: #ffffff;
            padding: 16px 40px;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 6px 20px rgba(5, 150, 105, 0.3);
            transition: all 0.3s ease;
          }
          
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(5, 150, 105, 0.4);
          }
          
          .review-timeline {
            display: flex;
            justify-content: space-between;
            margin: 30px 0;
            position: relative;
          }
          
          .review-timeline::before {
            content: '';
            position: absolute;
            top: 15px;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #059669, #047857);
          }
          
          .timeline-item {
            text-align: center;
            position: relative;
            z-index: 1;
            flex: 1;
          }
          
          .timeline-dot {
            width: 12px;
            height: 12px;
            background: #059669;
            border-radius: 50%;
            margin: 0 auto 8px;
            border: 3px solid white;
            box-shadow: 0 0 0 2px #059669;
          }
          
          .timeline-label {
            font-size: 12px;
            color: #64748b;
            font-weight: 500;
          }
          
          .life-changes-checklist {
            background: #f8fafc;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            border: 1px solid #e2e8f0;
          }
          
          .checklist-title {
            color: #1e293b;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 15px 0;
          }
          
          .checklist-item {
            display: flex;
            align-items: center;
            margin: 12px 0;
            font-size: 14px;
            color: #475569;
          }
          
          .checklist-icon {
            color: #059669;
            margin-right: 10px;
            font-size: 16px;
          }
        </style>
        
        <div class="review-card">
          <div class="card-header">
            <div class="floating-shape shape-1"></div>
            <div class="floating-shape shape-2"></div>
            <h1 class="header-title">Annual Policy Review</h1>
            <p class="header-subtitle">Protecting what matters most - your family's future</p>
          </div>
          
          <div style="padding: 40px 35px; line-height: 1.7; color: #4a5568; font-size: 15px; background: white;">
            ${body}
            
            <div class="life-changes-checklist">
              <div class="checklist-title">Life Changes to Discuss:</div>
              <div class="checklist-item">
                <span class="checklist-icon">✓</span>
                Marriage or divorce
              </div>
              <div class="checklist-item">
                <span class="checklist-icon">✓</span>
                New children or grandchildren
              </div>
              <div class="checklist-item">
                <span class="checklist-icon">✓</span>
                Change in employment or income
              </div>
              <div class="checklist-item">
                <span class="checklist-icon">✓</span>
                Home purchase or refinance
              </div>
              <div class="checklist-item">
                <span class="checklist-icon">✓</span>
                Health status changes
              </div>
            </div>
            
            <div class="review-timeline">
              <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-label">Initial Review</div>
              </div>
              <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-label">Needs Assessment</div>
              </div>
              <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-label">Policy Updates</div>
              </div>
              <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-label">Annual Review</div>
              </div>
            </div>
            
            <p>Let's schedule a convenient time to ensure your coverage aligns with your current situation and future goals.</p>
          </div>
          
          <div style="padding: 0 35px 40px 35px; text-align: center;">
            <a href="${ctaLink}" class="cta-button">${ctaText}</a>
          </div>
          
          <div style="padding: 30px 35px; background: linear-gradient(to right, #f8fafc, #f1f5f9); border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
            Protecting your family's future,<br>
            <span style="color: #334155; font-weight: 600; font-size: 15px;">${senderName}</span>
          </div>
        </div>
      </div>
    `
  },
  followUpEnhanced: {
    name: 'Follow-Up Enhanced',
    preview: 'Clean follow-up template with call-to-action',
    generate: (subject, body, senderName, ctaText = 'Get in Touch', ctaLink = '#') => `
      <div style="font-family: 'Montserrat', 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 30px 20px; background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px 25px; position: relative;">
            <div style="position: absolute; top: -10px; right: 30px; width: 70px; height: 70px; background: rgba(255,255,255,0.15); border-radius: 50%;"></div>
            <div style="position: absolute; bottom: 10px; left: 20px; width: 50px; height: 50px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
            <h2 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 500; position: relative; z-index: 1;">${subject}</h2>
          </div>
          <div style="padding: 35px 30px; line-height: 1.8; color: #4a5568; font-size: 15px;">
            ${body}
          </div>
          <div style="padding: 0 30px 35px 30px; text-align: center;">
            <a href="${ctaLink}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 15px; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">${ctaText}</a>
          </div>
          <div style="padding: 25px 30px; background: linear-gradient(to right, #faf9fc, #f5f3f9); border-top: 1px solid #e9e5f0; color: #64748b; font-size: 14px;">
            Best regards,<br>
            <span style="color: #334155; font-weight: 500;">${senderName}</span>
          </div>
        </div>
      </div>
    `
  },
  thanksgiving: {
    name: 'Thanksgiving',
    preview: 'Warm Thanksgiving greeting with animated pumpkins and falling leaves',
    generate: (subject, body, senderName) => `
      <div style="font-family: 'Montserrat', 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 30px 20px; background: linear-gradient(135deg, #fed7aa 0%, #fdba74 50%, #fed7aa 100%); position: relative; overflow: hidden; min-height: 600px;">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');
          
          .greeting-card {
            position: relative;
            z-index: 10;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(5px);
            border-radius: 16px;
            padding: 30px;
            border: 1px solid rgba(139, 69, 19, 0.3);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            text-align: center;
          }
          
          .title {
            font-family: 'Playfair Display', serif;
            font-size: 2.5rem;
            color: #8B4513;
            margin: 0 0 10px 0;
            font-weight: 700;
          }
          
          .subtitle {
            font-size: 1.2rem;
            color: #D2691E;
            margin: 0 0 20px 0;
            font-weight: 600;
          }
          
          .message {
            font-size: 1.1rem;
            color: #5a3921;
            line-height: 1.7;
            margin-bottom: 25px;
          }
          
          .signature {
            font-size: 1rem;
            color: #8B4513;
            font-weight: 600;
          }
          
          .falling-leaves {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
          }
          
          .leaf {
            position: absolute;
            font-size: 24px;
            opacity: 0;
            animation: falling 15s linear infinite;
          }
          
          @keyframes falling {
            0% {
              transform: translateY(-50px) translateX(0) rotate(0deg);
              opacity: 0;
            }
            10% {
              opacity: 0.8;
            }
            90% {
              opacity: 0.6;
            }
            100% {
              transform: translateY(600px) translateX(100px) rotate(360deg);
              opacity: 0;
            }
          }
          
          @keyframes pumpkinSway {
            0%, 100% { 
              transform: translateX(0px) rotate(0deg); 
              opacity: 0.8;
            }
            25% { 
              transform: translateX(-15px) rotate(-5deg); 
              opacity: 0.9;
            }
            50% { 
              transform: translateX(0px) rotate(0deg); 
              opacity: 1;
            }
            75% { 
              transform: translateX(15px) rotate(5deg); 
              opacity: 0.9;
            }
          }
          
          .pumpkin {
            position: absolute;
            font-size: 45px;
            animation: pumpkinSway 4s ease-in-out infinite;
            z-index: 0;
          }
          
          .pumpkin:nth-child(1) { left: 5%; top: 10%; animation-delay: 0s; }
          .pumpkin:nth-child(2) { right: 5%; top: 15%; animation-delay: 0.8s; }
          .pumpkin:nth-child(3) { left: 8%; bottom: 20%; animation-delay: 1.6s; }
          .pumpkin:nth-child(4) { right: 8%; bottom: 15%; animation-delay: 2.4s; }
          .pumpkin:nth-child(5) { left: 50%; top: 50%; animation-delay: 1.2s; opacity: 0.5; font-size: 35px; }
        </style>
        
        <!-- Pumpkins -->
        <div class="pumpkin">🎃</div>
        <div class="pumpkin">🎃</div>
        <div class="pumpkin">🎃</div>
        <div class="pumpkin">🎃</div>
        <div class="pumpkin">🎃</div>
        
        <!-- Falling Leaves -->
        <div class="falling-leaves" id="thanksgivingLeaves"></div>
        
        <script>
          (function() {
            const leavesContainer = document.getElementById('thanksgivingLeaves');
            const leafTypes = ['🍂', '🍁', '🥧', '🌰'];
            
            for (let i = 0; i < 15; i++) {
              const leaf = document.createElement('div');
              leaf.className = 'leaf';
              leaf.textContent = leafTypes[Math.floor(Math.random() * leafTypes.length)];
              
              const left = Math.random() * 100;
              const delay = Math.random() * 15;
              const duration = 10 + Math.random() * 10;
              const size = 20 + Math.random() * 15;
              
              leaf.style.left = \`\${left}%\`;
              leaf.style.animationDelay = \`\${delay}s\`;
              leaf.style.animationDuration = \`\${duration}s\`;
              leaf.style.fontSize = \`\${size}px\`;
              
              leavesContainer.appendChild(leaf);
            }
          })();
        </script>
        
        <div class="greeting-card">
          <h1 class="title">Happy Thanksgiving</h1>
          <h2 class="subtitle">${subject}</h2>
          <p class="message">${body}</p>
          <p class="signature">With grateful wishes,<br>${senderName}</p>
        </div>
      </div>
    `
  },
}


const sendEmailViaSES = async (emailData) => {
  const {
    recipients,
    subject,
    body,
    sender,
    attachments = [],
    design = 'default'
  } = emailData;

  try {
    // Apply template design
    const selectedDesign = templateDesigns[design] || templateDesigns.default;
    const htmlBody = selectedDesign.generate(subject, body, sender.fromName);

    // Prepare SES parameters
    const params = {
      Source: `${sender.fromName} <${sender.fromEmail}>`,
      Destination: {
        ToAddresses: recipients,
        CcAddresses: emailData.cc || [],
        BccAddresses: emailData.bcc || []
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          }
        }
      },
      ReplyToAddresses: [sender.replyTo || sender.fromEmail]
    };

    // Send email
    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command).promise();
    console.log('Email sent successfully:', result.MessageId);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = { sendEmailViaSES };