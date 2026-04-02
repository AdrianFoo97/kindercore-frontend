import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}

const testimonials = [
  { src: '/Testimonial/testi1.png', before: '孩子学会了', highlight: '自律和自信' },
  { src: '/Testimonial/testi2.png', before: '孩子变得更', highlight: '独立、自信', after: '，也爱上了学习' },
  { src: '/Testimonial/testi3.png', before: '孩子的', highlight: '自信、语言能力和社交能力', after: '都明显进步' },
  { src: '/Testimonial/testi4.png', before: '孩子的', highlight: '自信、独立和表达能力', after: '都有了很大的提升' },
  { src: '/Testimonial/testi 5.png', before: '孩子从分离焦虑到变得更加', highlight: '独立、社交能力和生活技能', after: '都明显提升' },
  { src: '/Testimonial/testi6.png', before: '孩子学会了', highlight: '发挥自己的潜能、展现自己' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'Noto Sans SC', 'Inter', system-ui, -apple-system, sans-serif",
      background: '#f5f6fa',
    }}>
      <div style={{ maxWidth: isDesktop ? undefined : 480, margin: '0 auto', minHeight: '100vh', overflow: isDesktop ? undefined : 'hidden' }}>

        {/* ── Hero ── */}
        <section style={{
          background: '#fff',
          padding: isDesktop ? '64px 48px 0' : '36px 20px 0',
          borderRadius: 0,
          textAlign: 'center' as const,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Logo */}
          <img src="/logo.png" alt="Ten Toes" style={{
            height: isDesktop ? 72 : 52, marginBottom: isDesktop ? 36 : 28,
          }} />

          <div style={{ maxWidth: isDesktop ? 680 : undefined, margin: '0 auto' }}>
            {/* Top — hook */}
            <p style={{
              margin: '0 auto',
              fontSize: isDesktop ? 22 : 17,
              fontWeight: 400,
              color: '#4b5563',
              lineHeight: 1.9,
              letterSpacing: '0.5px',
            }}>
              在这个 AI 时代，<br />孩子最不缺的就是"答案"
            </p>
            <p style={{
              margin: isDesktop ? '24px auto 0' : '20px auto 0',
              fontSize: isDesktop ? 32 : 23,
              fontWeight: 700,
              color: '#1e2a78',
              lineHeight: 1.7,
              letterSpacing: '1px',
            }}>
              真正影响孩子一生的，
              <br />
              是<span style={{ fontWeight: 900, color: '#b91c1c' }}>"想办法"</span>的能力
            </p>

            {/* Middle — contrast */}
            <div style={{ margin: isDesktop ? '40px auto 0' : '32px auto 0' }}>
              <p style={{
                margin: 0,
                fontSize: isDesktop ? 19 : 17,
                fontWeight: 400,
                color: '#6b7280',
                lineHeight: 1.8,
              }}>
                有些孩子习惯等待答案，
              </p>
              <p style={{
                margin: '0 auto',
                fontSize: isDesktop ? 19 : 17,
                fontWeight: 500,
                color: '#4b5563',
                lineHeight: 1.8,
              }}>
                也有些孩子，<span style={{ fontWeight: 700 }}>会主动去探索、尝试，</span>
                <br />
                <span style={{ fontWeight: 700 }}>去推开未知的大门</span>
              </p>
            </div>
          </div>

          {/* Hero image */}
          <div style={{
            margin: isDesktop ? '36px auto 0' : '28px -20px 0',
            maxWidth: isDesktop ? 720 : undefined,
            overflow: 'hidden',
          }}>
            <img src="/hero.jpg" alt="孩子在探索学习" style={{
              width: '100%',
              display: 'block',
              borderRadius: isDesktop ? 16 : 0,
            }} />
          </div>

          {/* Focus */}
          <div style={{
            margin: isDesktop ? '36px auto 0' : '28px auto 0',
            maxWidth: isDesktop ? 580 : undefined,
          }}>
            <p style={{
              margin: 0,
              fontSize: isDesktop ? 17 : 15,
              fontWeight: 500,
              color: '#6b7280',
              lineHeight: 1.8,
              letterSpacing: '2px',
            }}>
              这，就是我们正在栽培的孩子：
            </p>
            <p style={{
              margin: isDesktop ? '16px auto 4px' : '12px auto 4px',
              fontSize: isDesktop ? 16 : 14,
              fontWeight: 400,
              color: '#9ca3af',
              lineHeight: 1.6,
            }}>
              当遇到问题时会
            </p>
            <div style={{
              margin: isDesktop ? '16px auto 0' : '12px auto 0',
              padding: isDesktop ? '28px 32px' : '24px 20px',
              background: '#f8f9ff',
              borderRadius: 12,
              borderLeft: '3px solid #1e2a78',
            }}>
              <p style={{
                margin: 0,
                fontSize: isDesktop ? 26 : 22,
                fontWeight: 700,
                color: '#1e2a78',
                lineHeight: 1.9,
                letterSpacing: '1px',
              }}>
                好奇地问，不断地试，
                <br />
                在思考中，
                <br />
                一步步找到自己的答案
              </p>
            </div>
          </div>

          {/* Conclusion */}
          <p style={{
            margin: isDesktop ? '48px auto 0' : '40px auto 0',
            fontSize: isDesktop ? 22 : 19,
            fontWeight: 700,
            color: '#4b5563',
            lineHeight: 1.8,
            letterSpacing: '1.5px',
          }}>
            最终学会<span style={{ color: '#b91c1c' }}>"如何学习"</span>
          </p>

          {/* Bottom CTA */}
          <div style={{ margin: isDesktop ? '48px 0 52px' : '40px 0 40px', textAlign: 'center' as const }}>
            <button
              onClick={() => navigate('/enquiry/form?from=hero')}
              style={{
                padding: isDesktop ? '18px 52px' : '16px 40px',
                background: '#1e2a78',
                color: '#fff',
                border: 'none',
                borderRadius: 50,
                fontSize: isDesktop ? 17 : 15,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '1.5px',
                boxShadow: '0 6px 28px rgba(30,42,120,0.25)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 36px rgba(30,42,120,0.35)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(30,42,120,0.25)'; }}
            >
              预约参观学校
              <br />
              <span style={{ fontSize: isDesktop ? 12 : 11, fontWeight: 400, opacity: 0.8 }}>
                与园长 1 对 1 深入交流孩子的学习发展
              </span>
            </button>
          </div>

        </section>

      {/* Content container for everything after hero */}
      <div style={{ maxWidth: isDesktop ? undefined : 480, margin: '0 auto' }}>

        {/* ── Story: Section Header ── */}
        <div style={{
          margin: isDesktop ? '0 -9999px 0' : '0 -20px 0',
          padding: isDesktop ? '100px 9999px' : '80px 20px',
          background: 'linear-gradient(135deg, #1e2a78 0%, #2d3a8e 100%)',
          textAlign: 'center' as const,
        }}>
          <h2 style={{
            margin: 0,
            fontSize: isDesktop ? 26 : 22,
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.6,
            maxWidth: isDesktop ? 680 : undefined,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            孩子是这样学会<span style={{ color: '#f87171' }}>"想办法"</span>的
          </h2>
        </div>
        {/* Phase 1: 找到问题 — own card */}
        <div style={{
          margin: isDesktop ? '32px auto 0' : '24px 16px 0',
          padding: isDesktop ? '40px 56px 160px' : '28px 24px 120px',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          borderTop: '3px solid #1e2a78',
          maxWidth: isDesktop ? 680 : undefined,
          textAlign: 'center' as const,
          fontSize: isDesktop ? 20 : 18,
          color: '#4b5563',
          lineHeight: 2,
        }}>
          <div style={{ margin: '0 0 20px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: '50%',
              background: '#1e2a78', color: '#fff', fontSize: 14, fontWeight: 700,
            }}>1</span>
            <span style={{ fontSize: isDesktop ? 20 : 18, fontWeight: 700, color: '#1e2a78', letterSpacing: 2 }}>找到问题</span>
          </div>
          <p style={{ margin: '0 0 36px', color: '#6b7280' }}>
            在国庆日主题活动中，
            <br />
            老师给孩子们一个 task：
            <br />
            用 Edu Toys 搭一座双峰塔 🇲🇾
          </p>

          <video
            src="/national day.mp4"
            poster="/national day - thumbnail.jpeg"
            controls
            playsInline
            preload="metadata"
            style={{
              width: '100%',
              borderRadius: 12,
              margin: '0 0 28px',
              display: 'block',
            }}
          />

          <p style={{ margin: '0 0 36px' }}>
            孩子们花了差不多半个小时，
            <br />
            每一组都搭好了
          </p>
          <p style={{ margin: '0 0 36px' }}>
            可是——
          </p>
          <p style={{ margin: '0 0 6px', fontSize: isDesktop ? 24 : 21, fontWeight: 700, color: '#1e2a78' }}>
            一放上去，就倒下来
          </p>
          <p style={{ margin: '0 0 36px', fontSize: isDesktop ? 17 : 16, color: '#9ca3af' }}>
            再试一次，还是倒
          </p>

          <p style={{ margin: 0 }}>
            孩子们就问：
            <br />
            <span style={{ fontWeight: 600, color: '#1e2a78' }}>"Teacher，做么一直倒下来的？"</span>
          </p>
        </div>

        {/* Phase 2: 思考 */}
        <div style={{
          margin: isDesktop ? '24px auto 0' : '16px 16px 0',
          padding: isDesktop ? '40px 56px 160px' : '28px 24px 120px',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          borderTop: '3px solid #1e2a78',
          maxWidth: isDesktop ? 680 : undefined,
          textAlign: 'center' as const,
          fontSize: isDesktop ? 20 : 18,
          color: '#4b5563',
          lineHeight: 2,
        }}>
          <div style={{ margin: '0 0 20px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: '50%',
              background: '#1e2a78', color: '#fff', fontSize: 14, fontWeight: 700,
            }}>2</span>
            <span style={{ fontSize: isDesktop ? 20 : 18, fontWeight: 700, color: '#1e2a78', letterSpacing: 2 }}>思考原因</span>
          </div>

          <p style={{ margin: '0 0 36px' }}>
            老师<span style={{ fontWeight: 700, color: '#b91c1c' }}>没有直接给答案</span>
          </p>
          <p style={{ margin: '0 0 16px', color: '#6b7280' }}>
            只是拿起几块 Edu Toys，
            <br />
            在旁边做了两个 example：
          </p>
          <img src="/base.jpeg" alt="积木底部对比" style={{
            width: '100%',
            borderRadius: 12,
            margin: '0 0 16px',
            display: 'block',
          }} />
          <div style={{
            margin: '0 0 32px',
            padding: isDesktop ? '20px 24px' : '16px 20px',
            background: '#f8f9ff',
            borderRadius: 12,
            fontSize: isDesktop ? 18 : 16,
            color: '#6b7280',
            lineHeight: 2,
            textAlign: 'left' as const,
          }}>
            <p style={{ margin: '0 0 8px' }}>左边：底部大 → <span style={{ color: '#1e2a78', fontWeight: 600 }}>怎么摇都不会倒下来</span></p>
            <p style={{ margin: 0 }}>右边：底部小 → <span style={{ color: '#b91c1c' }}>摇一下就倒了</span></p>
          </div>

          <p style={{ margin: '0 0 36px' }}>
            老师看着他们，问：
            <br />
            <span style={{ color: '#6b7280' }}>"刚才那个为什么会倒？"</span>
          </p>

          <p style={{ margin: '0 0 8px' }}>
            其中一个小朋友就说：
          </p>
          <p style={{ margin: 0, fontSize: isDesktop ? 26 : 22, fontWeight: 700, color: '#1e2a78' }}>
            "下面太小了"
          </p>
        </div>

        {/* Phase 3: 解决 */}
        <section style={{
          margin: isDesktop ? '24px auto 0' : '16px 16px 0',
          padding: isDesktop ? '40px 56px 60px' : '28px 24px 48px',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          borderTop: '3px solid #1e2a78',
          maxWidth: isDesktop ? 680 : undefined,
          textAlign: 'center' as const,
        }}>
          <div style={{ fontSize: isDesktop ? 20 : 18, color: '#4b5563', lineHeight: 2 }}>
            <div style={{ margin: '0 0 20px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: '50%',
                background: '#1e2a78', color: '#fff', fontSize: 14, fontWeight: 700,
              }}>3</span>
              <span style={{ fontSize: isDesktop ? 20 : 18, fontWeight: 700, color: '#1e2a78', letterSpacing: 2 }}>尝试解决</span>
            </div>
            <p style={{ margin: '0 0 36px' }}>
              他们马上重新再做
              <br />
              先把底部做大一点，
              <br />
              再把塔慢慢往上叠
            </p>

            <p style={{ margin: '0 0 6px', fontSize: isDesktop ? 22 : 19, fontWeight: 700, color: '#b91c1c' }}>
              还是倒
            </p>
            <p style={{ margin: '0 0 36px', color: '#6b7280' }}>
              他们没有放弃，
              <br />
              继续把底部加宽、加稳
            </p>

            {/* Climax */}
            <p style={{ margin: '0 0 4px', fontSize: isDesktop ? 16 : 15, color: '#9ca3af', letterSpacing: 2 }}>
              这一次——
            </p>
            <p style={{ margin: '0 0 8px', fontSize: isDesktop ? 30 : 26, fontWeight: 700, color: '#1e2a78' }}>
              塔没有倒
            </p>
            <p style={{ margin: '0 0 40px', fontSize: isDesktop ? 17 : 16, color: '#9ca3af' }}>
              孩子们马上很开心地说：
              <br />
              "Teacher，我做好了！"
            </p>
            <img src="/twin tower.JPG" alt="双峰塔" style={{ width: '100%', borderRadius: 12, display: 'block' }} />

          </div>
        </section>

        {/* Takeaway — conclusion box */}
        <div style={{
          margin: isDesktop ? '56px auto 0' : '44px 16px 0',
          padding: isDesktop ? '64px 56px 72px' : '48px 24px 56px',
          background: '#f0f2ff',
          borderRadius: 16,
          maxWidth: isDesktop ? 680 : undefined,
          textAlign: 'center' as const,
        }}>
          <img src="/toys.jpeg" alt="学习活动" style={{ width: '100%', borderRadius: 12, margin: '0 0 36px', display: 'block' }} />
          <p style={{ margin: '0 0 48px', fontSize: isDesktop ? 21 : 19, color: '#6b7280', lineHeight: 1.9 }}>
            在这个学习过程中
            <br />
            他们学到的
            <br />
            <span style={{ color: 'red', fontWeight: 700 }}>不只是</span>把双峰塔搭起来
          </p>
          <p style={{ margin: '0 0 44px', fontSize: isDesktop ? 21 : 19, color: '#4b5563', lineHeight: 2 }}>
            更重要的是
            <br />
            当双峰塔一次次倒下来的时候
            <br />
            <span style={{ fontWeight: 700, color: '#b91c1c' }}>他们不会马上放弃</span>
          </p>
          <p style={{ margin: '0 0 48px', fontSize: isDesktop ? 21 : 19, color: '#4b5563', lineHeight: 2 }}>
            而是会停下来想一想
            <br />
            <span style={{ fontWeight: 700, color: '#b91c1c' }}>再试不同的方法</span>
          </p>
          <p style={{ margin: 0, fontSize: isDesktop ? 30 : 26, fontWeight: 700, color: '#1e2a78', lineHeight: 2 }}>
            一步一步，找到答案
          </p>
        </div>

        {/* CTA after story */}
        <div style={{ padding: '24px 24px', textAlign: 'center' as const }}>
          <button
            onClick={() => navigate('/enquiry/form?from=story')}
            style={{
              padding: isDesktop ? '18px 52px' : '16px 40px',
              background: '#1e2a78',
              color: '#fff',
              border: 'none',
              borderRadius: 50,
              fontSize: isDesktop ? 17 : 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '1.5px',
              boxShadow: '0 6px 28px rgba(30,42,120,0.25)',
            }}
          >
            预约参观学校
            <br />
            <span style={{ fontSize: isDesktop ? 12 : 11, fontWeight: 400, opacity: 0.8 }}>看看孩子在这里怎么学习</span>
          </button>
        </div>

        {/* ── How We Do It ── */}
        <section style={{
          padding: isDesktop ? '64px 24px' : '48px 24px',
          textAlign: 'center' as const,
          background: 'linear-gradient(180deg, #2d2a6e 0%, #1e1b54 100%)',
        }}>
          <p style={{ margin: '0 0 6px', fontSize: 14, color: 'rgba(255,255,255,0.45)', letterSpacing: 2 }}>
            在 Ten Toes
          </p>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.6 }}>
            我们如何引导孩子学会"想办法"
          </h2>
        </section>

        {/* ── Detail Sections (Cards) ── */}
        <div style={{
          padding: isDesktop ? '40px 48px 0' : '20px 16px 0',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 24,
          maxWidth: isDesktop ? 720 : undefined,
          margin: isDesktop ? '0 auto' : undefined,
        }}>

          {/* 1. 从好奇开始 */}
          <section style={{
            padding: isDesktop ? '40px 56px 60px' : '32px 24px 48px',
            textAlign: 'center' as const,
            lineHeight: 2,
            fontSize: isDesktop ? 20 : 18,
            color: '#4b5563',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            borderTop: '3px solid #1e2a78',
          }}>
            <div style={{ margin: '0 0 12px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: '50%',
                background: '#1e2a78', color: '#fff', fontSize: 15, fontWeight: 700,
              }}>01</span>
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: isDesktop ? 28 : 24, fontWeight: 700, color: '#1e2a78' }}>从好奇开始</h2>
            <p style={{ margin: '0 0 24px', fontSize: isDesktop ? 15 : 14, color: '#94a3b8', letterSpacing: 1 }}>探索式学习</p>
            <img src="/explore.jpeg" alt="探索式学习" style={{ width: '100%', borderRadius: 12, margin: '0 0 32px', display: 'block' }} />

            <p style={{ margin: '0 0 32px' }}>
              在课堂中，
              <br />
              孩子不会只是听答案
            </p>
            <p style={{ margin: '0 0 32px' }}>
              他们会自己动手，
              <br />
              一边试，一边观察
            </p>
            <p style={{ margin: '0 0 32px' }}>
              看看不同的做法，
              <br />
              会带来什么不一样的结果
            </p>
            <p style={{ margin: '0 0 32px' }}>
              慢慢地，
              <br />
              他们开始表达自己的想法，
              <br />
              也会主动提出问题
            </p>
          </section>

          {/* 2. 在尝试中学习 */}
          <section style={{
            padding: isDesktop ? '40px 56px 60px' : '32px 24px 48px',
            textAlign: 'center' as const,
            lineHeight: 2,
            fontSize: isDesktop ? 20 : 18,
            color: '#4b5563',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            borderTop: '3px solid #1e2a78',
          }}>
            <div style={{ margin: '0 0 12px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: '50%',
                background: '#1e2a78', color: '#fff', fontSize: 15, fontWeight: 700,
              }}>02</span>
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: isDesktop ? 28 : 24, fontWeight: 700, color: '#1e2a78' }}>在尝试中学习</h2>
            <p style={{ margin: '0 0 24px', fontSize: isDesktop ? 15 : 14, color: '#94a3b8', letterSpacing: 1 }}>活动式学习</p>
            <img src="/try.jpg" alt="活动式学习" style={{ width: '100%', borderRadius: 12, margin: '0 0 32px', display: 'block' }} />

            <p style={{ margin: '0 0 32px' }}>
              学习不只是听，
              <br />
              而是在一次次尝试中发生
            </p>
            <p style={{ margin: '0 0 32px' }}>
              孩子会动手参与，
              <br />
              不断去试，看看会发生什么
            </p>
            <p style={{ margin: '0 0 32px' }}>
              有时候成功，
              <br />
              有时候失败
            </p>
            <p style={{ margin: '0 0 32px' }}>
              当遇到困难时，
              <br />
              老师不会马上给答案，
            </p>
            <p style={{ margin: '0 0 32px' }}>
              而是引导他们再试一次：
            </p>
            <p style={{ margin: '0 0 32px', fontWeight: 600, color: '#1e2a78' }}>
              "我们可以换个方法试试看吗？"
            </p>
            <p style={{ margin: 0 }}>
              在一次次尝试中，
              <br />
              孩子慢慢找到自己的方法
            </p>
          </section>

          {/* 3. 在真实情境中成长 */}
          <section style={{
            padding: isDesktop ? '40px 56px 60px' : '32px 24px 48px',
            textAlign: 'center' as const,
            lineHeight: 2,
            fontSize: isDesktop ? 20 : 18,
            color: '#4b5563',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            borderTop: '3px solid #1e2a78',
          }}>
            <div style={{ margin: '0 0 12px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: '50%',
                background: '#1e2a78', color: '#fff', fontSize: 15, fontWeight: 700,
              }}>03</span>
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: isDesktop ? 28 : 24, fontWeight: 700, color: '#1e2a78' }}>在真实情境中成长</h2>
            <p style={{ margin: '0 0 24px', fontSize: isDesktop ? 15 : 14, color: '#94a3b8', letterSpacing: 1 }}>真实体验活动</p>
            <img src="/event.jpeg" alt="真实体验活动" style={{ width: '100%', borderRadius: 12, margin: '0 0 32px', display: 'block' }} />

            <p style={{ margin: '0 0 32px' }}>
              在课堂与活动中，
              <br />
              孩子会面对真实的情境
            </p>
            <p style={{ margin: '0 0 32px' }}>
              他们需要自己动手，
              <br />
              也需要自己做决定。
            </p>
            <p style={{ margin: '0 0 32px' }}>
              例如在模拟 bazaar 的活动中，
              <br />
              孩子要用"钱"来进行买卖，
              <br />
              要买什么、用多少钱。
            </p>
            <p style={{ margin: '0 0 32px' }}>
              当结果不如预期时，
              <br />
              他们会停下来想一想，
              <br />
              再调整自己的做法。
            </p>
            <p style={{ margin: '0 0 32px' }}>
              在这样的过程中，
              <br />
              孩子不只是完成一个活动，
            </p>
            <p style={{ margin: 0, fontWeight: 600, color: '#1e2a78' }}>
              而是慢慢学会
              <br />
              自己做决定，
              <br />
              也能一步一步把问题解决。
            </p>
          </section>

        </div>

        <div style={{ padding: '28px 24px', textAlign: 'center' as const }}>
          <button
            onClick={() => navigate('/enquiry/form?from=methods')}
            style={{
              padding: isDesktop ? '18px 52px' : '16px 40px',
              background: '#1e2a78',
              color: '#fff',
              border: 'none',
              borderRadius: 50,
              fontSize: isDesktop ? 17 : 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '1.5px',
              boxShadow: '0 6px 28px rgba(30,42,120,0.25)',
            }}
          >
            预约参观学校
            <br />
            <span style={{ fontSize: isDesktop ? 12 : 11, fontWeight: 400, opacity: 0.8 }}>看看孩子在这里怎么学习</span>
          </button>
        </div>

        {/* ── 融入课程 ── */}
        <section style={{
          padding: isDesktop ? '64px 48px 72px' : '52px 24px 56px',
          textAlign: 'center' as const,
          background: '#2d2a6e',
        }}>
          <div style={{ maxWidth: isDesktop ? 1100 : undefined, margin: '0 auto' }}>
          {/* Heading area */}
          <p style={{
            margin: 0,
            fontSize: isDesktop ? 14 : 12,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: 3,
          }}>这些学习方式</p>
          <h2 style={{
            margin: '10px 0 40px',
            fontSize: isDesktop ? 28 : 23,
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.4,
          }}>都融入在我们的课程里</h2>

          {/* Programme cards */}
          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 12,
            maxWidth: isDesktop ? 480 : 320,
            margin: '0 auto',
          }}>
            {[
              { num: '01', title: '日常课程', desc: '在课堂中学会提问、思考与表达', time: '8:30am – 12:30pm' },
              { num: '02', title: '日常 + SMILE 音乐课', desc: '在音乐与互动中表达想法、建立自信', time: '8:30am – 2:30pm' },
              { num: '03', title: 'Full Day 学习生活', desc: '在日常生活中学会自己安排、自己处理问题', time: '8:30am – 5:30pm' },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 14,
                padding: '20px 22px 18px',
                textAlign: 'left' as const,
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.18)', letterSpacing: 1, minWidth: 20 }}>{item.num}</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{item.title}</span>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, paddingLeft: 30, marginBottom: 6 }}>{item.desc}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: 0.5, paddingLeft: 30 }}>{item.time}</div>
              </div>
            ))}
          </div>

          {/* CTA area */}
          <div style={{ marginTop: 40 }}>
            <button
              onClick={() => navigate('/enquiry/form?from=methods')}
              style={{
                padding: isDesktop ? '18px 52px' : '16px 40px',
                background: '#fff',
                color: '#1e2a78',
                border: 'none',
                borderRadius: 50,
                fontSize: isDesktop ? 17 : 15,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '1.5px',
                boxShadow: '0 6px 28px rgba(0,0,0,0.2)',
              }}
            >
              预约参观学校
              <br />
              <span style={{ fontSize: isDesktop ? 12 : 11, fontWeight: 400, opacity: 0.8 }}>了解课程详情</span>
            </button>
          </div>
          </div>
        </section>

        {/* ── Scrolling Gallery ── */}
        {(() => {
          const scrollImages = ['/scroll0.jpg', '/scroll1.jpg', '/scroll 2.JPG', '/scroll4.jpg', '/scroll 5.jpg', '/scroll 6.jpeg'];
          const ScrollGallery = () => {
            const [current, setCurrent] = useState(0);
            useEffect(() => {
              const timer = setInterval(() => setCurrent(c => (c + 1) % scrollImages.length), 4000);
              return () => clearInterval(timer);
            }, []);
            return (
              <div style={{ padding: isDesktop ? '48px 0' : '36px 0', background: '#fff', overflow: 'hidden' }}>
                {isDesktop ? (
                  <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative' }}>
                    <div style={{ overflow: 'hidden', borderRadius: 16 }}>
                      <img
                        src={scrollImages[current]}
                        alt={`学习活动 ${current + 1}`}
                        style={{ width: '100%', height: 420, objectFit: 'cover' as const, display: 'block', transition: 'opacity 0.5s' }}
                      />
                    </div>
                    <button
                      onClick={() => setCurrent(c => (c - 1 + scrollImages.length) % scrollImages.length)}
                      style={{ position: 'absolute', left: -48, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.3)', color: '#fff', border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >‹</button>
                    <button
                      onClick={() => setCurrent(c => (c + 1) % scrollImages.length)}
                      style={{ position: 'absolute', right: -48, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.3)', color: '#fff', border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >›</button>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                      {scrollImages.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrent(i)}
                          style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', background: i === current ? '#1e2a78' : '#d1d5db', cursor: 'pointer', padding: 0 }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', gap: 14, paddingLeft: 24, paddingRight: 24,
                    overflowX: 'auto' as const, scrollSnapType: 'x mandatory' as const,
                    WebkitOverflowScrolling: 'touch' as any, msOverflowStyle: 'none' as any, scrollbarWidth: 'none' as any,
                  }}>
                    {scrollImages.map((src, i) => (
                      <img key={i} src={src} alt={`学习活动 ${i + 1}`} style={{ width: '85%', minWidth: '85%', height: 220, objectFit: 'cover' as const, borderRadius: 14, scrollSnapAlign: 'center' as const }} />
                    ))}
                    <div style={{ minWidth: 1 }} />
                  </div>
                )}
              </div>
            );
          };
          return <ScrollGallery />;
        })()}

        {/* ── Transition Section (white) ── */}
        <section style={{
          padding: isDesktop ? '64px 24px' : '0 24px 48px',
          textAlign: 'center' as const,
          background: '#fff',
          color: '#4b5563',
          fontSize: isDesktop ? 22 : 18,
          lineHeight: 2,
        }}>
        <div style={{ maxWidth: isDesktop ? 680 : undefined, margin: '0 auto' }}>
          <p style={{ margin: '0 0 28px' }}>
            这些课程
            <br />
            看起来不一样
          </p>
          <p style={{ margin: '0 0 28px', fontSize: isDesktop ? 20 : 15, color: '#4b5563' }}>
            但其实都在做同一件事——
          </p>
          <p style={{ margin: '0 0 0', fontSize: isDesktop ? 28 : 22, fontWeight: 700, color: '#1e2a78', lineHeight: 1.7 }}>
            让孩子在遇到问题时
            <br />
            <span style={{ color: '#1e2a78' }}>不会马上放弃</span>
            <br />
            而是愿意自己<span style={{ color: '#1e2a78' }}>想一想、试一试</span>
          </p>

          {/* Divider */}
          <div style={{ width: 40, height: 2, background: '#e2e8f0', margin: '36px auto' }} />

          <p style={{ margin: '0 0 28px' }}>
            慢慢地
            <br />
            他们变得<span style={{ fontWeight: 700, color: 'red' }}>更独立</span>
          </p>
          <p style={{ margin: '0 0 28px' }}>
            也更愿意
            <br />
            <span style={{ fontWeight: 700, color: 'red' }}>自己去面对问题</span>
          </p>

          <div style={{ height: 12 }} />

          <p style={{ margin: '0 0 28px' }}>
            这些改变
            <br />
            <span style={{ fontWeight: 700, color: 'red' }}>不只是发生在学校</span>
          </p>
          <p style={{ margin: '0 0 0' }}>
            很多家长
            <br />
            在日常生活中
            <br />
            也开始看到一样的变化
          </p>

        </div>
        </section>

        {/* ── Testimonials ── */}
        <section style={{
          padding: isDesktop ? '56px 48px 64px' : '40px 0 48px',
          textAlign: 'center' as const,
          background: '#2d2a6e',
        }}>
          <div style={{ maxWidth: isDesktop ? 1100 : undefined, margin: '0 auto' }}>
          <h2 style={{ margin: '0 0 40px', fontSize: isDesktop ? 28 : 22, fontWeight: 700, color: '#fff' }}>
            他们是这样说的：
          </h2>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 24,
            padding: isDesktop ? 0 : '0 12px',
            maxWidth: isDesktop ? 600 : undefined,
            margin: '0 auto',
          }}>
            {testimonials.map((item, i) => (
              <div key={i}>
                <p style={{
                  margin: '0 0 12px',
                  fontSize: 16,
                  color: 'rgba(255,255,255,0.7)',
                  textAlign: 'center' as const,
                }}>
                  "{item.before}{item.highlight && <span style={{ fontWeight: 700, color: '#fff' }}>{item.highlight}</span>}{item.after || ''}"
                </p>
                <div style={{
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
                }}>
                  <img
                    src={item.src}
                    alt={`家长评价 ${i + 1}`}
                    style={{ width: '100%', display: 'block' }}
                  />
                </div>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* CTA section after testimonials */}
        <section style={{
          background: '#fff',
          padding: isDesktop ? '72px 24px' : '56px 24px',
          textAlign: 'center' as const,
          color: '#475569',
        }}>
        <div style={{ maxWidth: isDesktop ? 680 : undefined, margin: '0 auto' }}>
          <p style={{
            margin: '0 0 32px',
            fontSize: isDesktop ? 22 : 18,
            lineHeight: 2,
          }}>
            如果你也希望孩子
            <br />慢慢变得<span style={{ fontWeight: 700, color: 'red' }}>更独立</span>
            <br /><span style={{ fontWeight: 700, color: 'red' }}>更有自信</span>
          </p>
          <p style={{
            margin: '0 0 36px',
            fontSize: isDesktop ? 22 : 18,
            lineHeight: 2,
          }}>
            在遇到问题时
            <br />也愿意自己<span style={{ fontWeight: 700, color: 'red' }}>想一想、试一试</span>
          </p>
          <p style={{
            margin: '0 0 32px',
            fontSize: isDesktop ? 22 : 18,
            lineHeight: 2,
          }}>
            <span style={{ fontWeight: 700, color: '#1e2a78' }}>欢迎来学校看看</span>
            <br />孩子在这里的学习
            <br />是如何一点一点发生的
          </p>
          <p style={{
            margin: '0 0 32px',
            fontSize: isDesktop ? 22 : 18,
            lineHeight: 2,
            color: '#4b5563',
          }}>
            填写表格后
            <br />我们会通过 WhatsApp 联系您
            <br />安排参观时间
          </p>
          <button
            onClick={() => navigate('/enquiry/form?from=final')}
            style={{
              padding: isDesktop ? '18px 52px' : '16px 40px',
              background: '#1e2a78',
              color: '#fff',
              border: 'none',
              borderRadius: 50,
              fontSize: isDesktop ? 17 : 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '1.5px',
              boxShadow: '0 6px 28px rgba(30,42,120,0.25)',
            }}
          >
            填写表格，预约参观
          </button>
        </div>
        </section>

      </div>
      </div>
    </div>
  );
}
