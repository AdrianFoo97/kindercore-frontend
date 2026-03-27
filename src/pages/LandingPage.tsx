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
      background: '#ffffff',
    }}>
      <div style={{ maxWidth: isDesktop ? undefined : 480, margin: '0 auto', minHeight: '100vh', overflow: isDesktop ? undefined : 'hidden' }}>

        {/* ── Hero ── */}
        <section style={{
          background: '#fff',
          padding: isDesktop ? '48px 48px 0' : '36px 20px 0',
          borderRadius: 0,
          textAlign: 'center' as const,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Logo */}
          <img src="/logo.png" alt="Ten Toes" style={{
            height: isDesktop ? 72 : 52, marginBottom: isDesktop ? 36 : 28,
          }} />

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
            fontSize: isDesktop ? 30 : 23,
            fontWeight: 700,
            color: '#1e2a78',
            lineHeight: 1.7,
            letterSpacing: '1px',
          }}>
            真正影响孩子一生的，
            <br />
            是孩子<span style={{ fontWeight: 900, color: '#b91c1c' }}>"想办法"</span>的能力
          </p>

          {/* Middle — contrast */}
          <div style={{
            margin: isDesktop ? '40px auto 0' : '32px auto 0',
            maxWidth: isDesktop ? 480 : undefined,
          }}>
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

          {/* Hero image — full bleed */}
          <div style={{
            margin: isDesktop ? '36px auto 0' : '28px -20px 0',
            maxWidth: isDesktop ? 560 : undefined,
            overflow: 'hidden',
          }}>
            <img src="/hero.jpg" alt="孩子在探索学习" style={{
              width: '100%',
              display: 'block',
            }} />
          </div>

          {/* Focus */}
          <div style={{
            margin: isDesktop ? '36px auto 0' : '28px auto 0',
            maxWidth: isDesktop ? 480 : undefined,
          }}>
            <p style={{
              margin: 0,
              fontSize: isDesktop ? 17 : 15,
              fontWeight: 500,
              color: '#6b7280',
              lineHeight: 1.8,
              letterSpacing: '2px',
            }}>
              这，就是我们正栽培的孩子：
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
          margin: isDesktop ? '80px -9999px 0' : '60px -20px 0',
          padding: isDesktop ? '52px 9999px' : '40px 20px',
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
        <section style={{
          margin: isDesktop ? '32px auto 0' : '24px 16px 0',
          padding: isDesktop ? '40px 56px 48px' : '28px 24px 32px',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          border: '1px solid #e5e7eb',
          maxWidth: isDesktop ? 680 : undefined,
          textAlign: 'center' as const,
        }}>

          {/* Narrative — centered cinematic */}
          <div style={{ fontSize: isDesktop ? 20 : 18, color: '#4b5563', lineHeight: 2 }}>
            {/* Setup */}
            <p style={{ margin: '0 0 28px', color: '#6b7280' }}>
              在国庆日主题活动中，
              <br />
              老师给孩子们一个 task：
              <br />
              用 Edu Toys 搭一座双峰塔 🇲🇾
            </p>

            <video
              src="/national day.mp4"
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

            <p style={{ margin: '0 0 28px' }}>
              孩子们花了差不多半个小时，
              <br />
              每一组都搭好了
            </p>
            <p style={{ margin: '0 0 28px' }}>
              可是——
            </p>
            <p style={{ margin: '0 0 6px', fontSize: isDesktop ? 24 : 21, fontWeight: 700, color: '#1e2a78' }}>
              一放上去，就倒下来
            </p>
            <p style={{ margin: '0 0 32px', fontSize: isDesktop ? 17 : 16, color: '#9ca3af' }}>
              再试一次，还是倒
            </p>

            <p style={{ margin: '0 0 32px' }}>
              孩子们就问：
              <br />
              <span style={{ fontWeight: 600, color: '#1e2a78' }}>"Teacher，做么一直倒下来的？"</span>
            </p>

            {/* Teacher's approach */}
            <p style={{ margin: '0 0 28px' }}>
              老师走过来，<span style={{ fontWeight: 600, color: '#1e2a78' }}>没有直接告诉他们答案</span>
            </p>
            <p style={{ margin: '0 0 16px', color: '#6b7280' }}>
              她拿起几块积木，在旁边轻轻做了两个 example：
            </p>
            <div style={{
              margin: '0 0 32px',
              padding: isDesktop ? '20px 24px' : '16px 20px',
              background: '#f8f9ff',
              borderRadius: 12,
              borderLeft: '3px solid #1e2a78',
              fontSize: isDesktop ? 18 : 16,
              color: '#6b7280',
              lineHeight: 2,
              textAlign: 'left' as const,
            }}>
              <p style={{ margin: '0 0 4px' }}>1. 一个底部很小 → 一放上去，就倒了</p>
              <p style={{ margin: 0 }}>2. 一个底部比较大 → 放在桌子上，怎么摇都不会倒</p>
            </div>

            <p style={{ margin: '0 0 28px' }}>
              老师看着他们，问：
              <br />
              <span style={{ color: '#6b7280' }}>"刚才那个为什么会倒？"</span>
            </p>

            <p style={{ margin: '0 0 8px' }}>
              其中一个小朋友就说：
            </p>
            <p style={{ margin: '0 0 32px', fontSize: isDesktop ? 26 : 22, fontWeight: 700, color: '#1e2a78' }}>
              "下面太小了"
            </p>

            <p style={{ margin: '0 0 28px' }}>
              他们马上重新再做
              <br />
              先把底部做大一点，再把塔慢慢往上叠
            </p>

            <p style={{ margin: '0 0 6px', fontSize: isDesktop ? 17 : 16, color: '#9ca3af' }}>
              还是倒
            </p>
            <p style={{ margin: '0 0 32px', color: '#6b7280' }}>
              他们没有放弃，继续把底部加宽、加稳
            </p>

            {/* Climax */}
            <p style={{ margin: '0 0 4px', fontSize: isDesktop ? 16 : 15, color: '#9ca3af', letterSpacing: 2 }}>
              这一次——
            </p>
            <p style={{ margin: '0 0 8px', fontSize: isDesktop ? 30 : 26, fontWeight: 700, color: '#1e2a78' }}>
              塔没有倒
            </p>
            <p style={{ margin: '0 0 40px', fontSize: isDesktop ? 17 : 16, color: '#9ca3af' }}>
              孩子们马上很开心地说："Teacher，我做好了！"
            </p>

            {/* Takeaway */}
            <div style={{
              margin: 0,
              padding: isDesktop ? '28px 32px' : '24px 20px',
              background: '#fafafa',
              borderRadius: 12,
            }}>
              <p style={{ margin: '0 0 12px', fontSize: isDesktop ? 17 : 16, color: '#9ca3af' }}>
                在这个过程中，他们学到的，不只是把塔搭起来
              </p>
              <p style={{ margin: '16px 0 0', fontSize: isDesktop ? 22 : 19, fontWeight: 700, color: '#1e2a78', textAlign: 'center' as const, lineHeight: 1.8 }}>
                而是遇到问题时，
                <br />
                会自己想办法，
                <br />
                一步一步找到答案
              </p>
            </div>
          </div>
        </section>

        {/* CTA after story */}
        <div style={{ padding: '24px 24px', textAlign: 'center' as const }}>
          <button
            onClick={() => navigate('/enquiry/form?from=story')}
            style={{
              padding: '14px 40px',
              background: '#1a1a8e',
              color: '#fff',
              border: 'none',
              borderRadius: 50,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '1.5px',
              boxShadow: '0 4px 16px rgba(26, 26, 142, 0.25)',
            }}
          >
            预约参观学校
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
          <h2 style={{ margin: '0 0 40px', fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.6 }}>
            我们是这样陪伴孩子学习的
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 0 }}>
            {[
              { num: '1', title: '探索式学习', desc: '让孩子从好奇开始，\n主动去问、去发现。' },
              { num: '2', title: '活动式学习', desc: '让孩子在参与、尝试与讨论中，\n学会自己找到答案。' },
              { num: '3', title: '真实体验活动', desc: '让孩子在真实情境中，\n学会尝试、解决问题，并逐渐独立。' },
            ].map((item, i) => (
              <div key={i} style={{
                padding: '32px 20px',
                borderTop: i === 0 ? '1px solid rgba(255,255,255,0.12)' : 'none',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
              }}>
                <div style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.12)',
                  marginBottom: 6,
                }}>
                  {item.num}
                </div>
                <div style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: 14,
                }}>
                  {item.title}
                </div>
                <div style={{
                  fontSize: 16,
                  color: 'rgba(255,255,255,0.6)',
                  lineHeight: 1.9,
                }}>
                  {item.desc.split('\n').map((line, j) => (
                    <span key={j}>{line}{j < item.desc.split('\n').length - 1 && <br />}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </section>

        {/* ── Detail Sections (Cards) ── */}
        <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column' as const, gap: 16, maxWidth: isDesktop ? 1120 : undefined, margin: isDesktop ? '0 auto' : undefined }}>

          {/* 1. 探索式学习 */}
          <section style={{
            padding: '32px 24px',
            textAlign: 'center' as const,
            lineHeight: 1.9,
            fontSize: 15,
            color: '#475569',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#5a79c8', letterSpacing: '1px', marginBottom: 6 }}>01</div>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>探索式学习</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8' }}>培养孩子的好奇心</p>

            <p style={{ margin: '0 0 16px' }}>
              在课堂中，
              <br />
              我们不会一直讲给孩子听。
            </p>
            <p style={{ margin: '0 0 16px' }}>
              因为我们发现，
              <br />
              孩子不是听得越多，就学得越好。
            </p>
            <p style={{ margin: '0 0 16px' }}>
              反而，当老师开始提问，
              <br />
              孩子会开始去想、去回答。
            </p>
            <p style={{ margin: '0 0 16px' }}>
              有时候，他们会说出自己的想法，
              <br />
              也会和同学一起讨论不同的答案。
            </p>
            <p style={{ margin: '0 0 16px' }}>
              在这样的过程中，
              <br />
              孩子不是在记答案，
              <br />
              而是慢慢学会自己去想、去问。
            </p>
            <p style={{ margin: 0 }}>
              久而久之，
              <br />
              好奇心就会成为他们学习的动力。
            </p>
          </section>

          {/* 2. 互动式课堂 */}
          <section style={{
            padding: '32px 24px',
            textAlign: 'center' as const,
            lineHeight: 1.9,
            fontSize: 15,
            color: '#475569',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#5a79c8', letterSpacing: '1px', marginBottom: 6 }}>02</div>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>在活动中学习</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8' }}>在参与中学会尝试</p>

            <p style={{ margin: '0 0 16px' }}>
              在课堂中，
              <br />
              孩子不只是听课。
            </p>
            <p style={{ margin: '0 0 16px' }}>
              他们会参与活动、一起尝试，
              <br />
              在过程中动手、思考。
            </p>
            <p style={{ margin: '0 0 16px' }}>
              有时会讨论、分享想法，
              <br />
              也会在尝试中发现问题、调整方法。
            </p>
            <p style={{ margin: '0 0 16px' }}>
              老师会在过程中引导孩子，
              <br />
              让他们慢慢理解，而不是直接给答案。
            </p>
            <p style={{ margin: 0 }}>
              慢慢地，
              <br />
              孩子会更敢尝试，
              <br />
              也更懂得自己去找到答案。
            </p>
          </section>

          {/* 3. 真实体验活动 */}
          <section style={{
            padding: '32px 24px',
            textAlign: 'center' as const,
            lineHeight: 1.9,
            fontSize: 15,
            color: '#475569',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#5a79c8', letterSpacing: '1px', marginBottom: 6 }}>03</div>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>真实体验活动</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8' }}>让孩子学会独立</p>

            <p style={{ margin: '0 0 16px' }}>
              我们相信很多能力
              <br />
              不是通过讲解学会的，
              <br />
              而是在体验中成长。
            </p>
            <p style={{ margin: '0 0 16px' }}>
              通过各种活动和真实情境，
              <br />
              孩子会尝试自己解决问题、
              <br />
              做决定和承担责任。
            </p>
            <p style={{ margin: 0 }}>
              在一次次体验中，
              <br />
              孩子会慢慢变得更独立。
            </p>
          </section>

        </div>

        {/* CTA after cards */}
        <div style={{ padding: '28px 24px', textAlign: 'center' as const }}>
          <button
            onClick={() => navigate('/enquiry/form?from=methods')}
            style={{
              padding: '14px 40px',
              background: '#1a1a8e',
              color: '#fff',
              border: 'none',
              borderRadius: 50,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '1.5px',
              boxShadow: '0 4px 16px rgba(26, 26, 142, 0.25)',
            }}
          >
            预约参观学校
          </button>
        </div>

        {/* ── 融入课程 ── */}
        <section style={{
          padding: '48px 24px',
          textAlign: 'center' as const,
          background: '#2d2a6e',
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.45)', letterSpacing: 2 }}>这些学习方式</p>
          <h2 style={{ margin: '0 0 36px', fontSize: 22, fontWeight: 700, color: '#fff' }}>都融入在我们的课程里</h2>

          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16, maxWidth: 320, margin: '0 auto' }}>
            {[
              { num: '01', title: '日常课程', desc: '建立基础学习能力' },
              { num: '02', title: 'SMILE 音乐课', desc: '在音乐中表达自己' },
              { num: '03', title: 'Full Day 学习生活', desc: '在真实情境中成长' },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '20px',
                textAlign: 'left' as const,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.15)',
                    lineHeight: 1,
                  }}>
                    {item.num}
                  </span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Course Details (Cards) ── */}
        <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column' as const, gap: 16 }}>

          {/* 01 日常课程 */}
          <section style={{
            padding: '32px 24px',
            textAlign: 'center' as const,
            lineHeight: 1.9,
            fontSize: 15,
            color: '#475569',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#5a79c8', letterSpacing: '1px', marginBottom: 6 }}>01</div>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>日常课程</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8' }}>建立基础学习能力</p>

            <p style={{ margin: '0 0 16px' }}>
              在日常课程中，
              <br />
              孩子会通过不同主题的学习活动，
              <br />
              慢慢建立基础的学习能力。
            </p>
            <p style={{ margin: '0 0 16px' }}>
              课堂不只是听老师讲解，
              <br />
              孩子会通过观察、讨论和动手体验
              <br />
              参与学习的过程。
            </p>
            <p style={{ margin: 0 }}>
              在这样的学习环境中，
              <br />
              孩子不仅理解知识，
              <br />
              也培养专注力和主动学习的习惯。
            </p>
          </section>

          {/* 02 SMILE 音乐课 */}
          <section style={{
            padding: '32px 24px',
            textAlign: 'center' as const,
            lineHeight: 1.9,
            fontSize: 15,
            color: '#475569',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#5a79c8', letterSpacing: '1px', marginBottom: 6 }}>02</div>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>SMILE 音乐课</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8' }}>在音乐中表达自己</p>

            <p style={{ margin: '0 0 16px' }}>
              在 SMILE 音乐课程中，
              <br />
              孩子会通过音乐、节奏和律动活动
              <br />
              探索声音与身体表达。
            </p>
            <p style={{ margin: '0 0 16px' }}>
              课程结合游戏和互动，
              <br />
              让孩子在轻松的氛围中
              <br />
              感受音乐的乐趣。
            </p>
            <p style={{ margin: 0 }}>
              在一次次音乐活动中，
              <br />
              孩子会更愿意表达自己，
              <br />
              也慢慢建立自信。
            </p>
          </section>

          {/* 03 Full Day 学习生活 */}
          <section style={{
            padding: '32px 24px',
            textAlign: 'center' as const,
            lineHeight: 1.9,
            fontSize: 15,
            color: '#475569',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#5a79c8', letterSpacing: '1px', marginBottom: 6 }}>03</div>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Full Day 学习生活</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8' }}>在真实情境中成长</p>

            <p style={{ margin: '0 0 16px' }}>
              在 Full Day 的学习生活中，
              <br />
              孩子不仅参与课堂活动，
              <br />
              也会经历许多真实的生活情境。
            </p>
            <p style={{ margin: '0 0 16px' }}>
              例如与同伴合作、
              <br />
              解决问题、
              <br />
              照顾自己的物品和空间。
            </p>
            <p style={{ margin: 0 }}>
              在这些日常体验中，
              <br />
              孩子会慢慢建立独立能力和责任感。
            </p>
          </section>

        </div>

        {/* CTA after course detail cards */}
        <div style={{ padding: '28px 24px', textAlign: 'center' as const }}>
          <button
            onClick={() => navigate('/enquiry/form?from=courses')}
            style={{
              padding: '14px 40px',
              background: '#1a1a8e',
              color: '#fff',
              border: 'none',
              borderRadius: 50,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '1.5px',
              boxShadow: '0 4px 16px rgba(26, 26, 142, 0.25)',
            }}
          >
            预约参观学校
          </button>
        </div>

        {/* ── Transition Section ── */}
        <section style={{
          padding: isDesktop ? '64px 24px' : '48px 24px',
          textAlign: 'center' as const,
          background: 'linear-gradient(180deg, #2d2a6e 0%, #1e1b54 100%)',
          color: 'rgba(255,255,255,0.7)',
          fontSize: 15,
          lineHeight: 1.9,
        }}>
          <p style={{ margin: '0 0 40px' }}>
            这些课程，
            <br />
            虽然内容不同，
          </p>
          <p style={{ margin: '0 0 8px' }}>
            但都在做同一件事：
          </p>
          <p style={{ margin: '0 0 0', fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.6 }}>
            培养孩子自主学习
            <br />
            与解决问题的能力。
          </p>

          {/* Divider */}
          <div style={{ width: 40, height: 2, background: 'rgba(255,255,255,0.2)', margin: '32px auto' }} />

          <p style={{ margin: '0 0 40px' }}>
            也正因为这样的学习方式，
            <br />
            孩子会慢慢变得更独立，
            <br />
            也更愿意自己尝试解决问题。
          </p>
          <p style={{ margin: '0 0 40px' }}>
            这些改变，
            <br />
            不只发生在学校。
          </p>
          <p style={{ margin: '0 0 40px' }}>
            很多家长，
            <br />
            也在生活中看到了同样的变化。
          </p>
          <p style={{ margin: 0, color: '#fff', fontWeight: 600, fontSize: 16 }}>
            他们是这样说的：
          </p>
        </section>

        {/* ── Testimonials ── */}
        <section style={{
          padding: '40px 0',
          textAlign: 'center' as const,
          maxWidth: isDesktop ? 1120 : undefined,
          margin: isDesktop ? '0 auto' : undefined,
        }}>
          <h2 style={{ margin: '0 0 28px', fontSize: isDesktop ? 28 : 22, fontWeight: 700, color: '#1e293b' }}>
            家长的分享
          </h2>

          <div style={{ display: isDesktop ? 'grid' : 'flex', gridTemplateColumns: isDesktop ? '1fr 1fr' : undefined, flexDirection: isDesktop ? undefined : 'column' as const, gap: isDesktop ? 24 : 20, padding: isDesktop ? '0 32px' : '0 24px' }}>
            {testimonials.map((item, i) => (
              <div key={i}>
                <p style={{
                  margin: '0 0 8px',
                  fontSize: 14,
                  color: '#475569',
                  textAlign: 'center' as const,
                }}>
                  "{item.before}{item.highlight && <span style={{ fontWeight: 700, color: '#1a1a8e' }}>{item.highlight}</span>}{item.after || ''}"
                </p>
                <div style={{
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
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
        </section>

        {/* Dark CTA section after testimonials */}
        <section style={{
          background: 'linear-gradient(160deg, #1a1a5e 0%, #2d2d8a 100%)',
          padding: isDesktop ? '72px 24px' : '56px 24px',
          textAlign: 'center' as const,
          color: '#fff',
        }}>
          <p style={{
            margin: '0 0 28px',
            fontSize: 16,
            lineHeight: 2,
            color: 'rgba(255,255,255,0.85)',
          }}>
            如果你也希望孩子
            <br />变得更独立
            <br />更有自信
            <br />也更愿意自己尝试解决问题
          </p>
          <p style={{
            margin: '0 0 32px',
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.8,
          }}>
            欢迎亲自来看看
            <br />Ten Toes 的孩子
            <br />是如何在每天的学习中
            <br />慢慢变成这样的
          </p>
          <button
            onClick={() => navigate('/enquiry/form?from=final')}
            style={{
              padding: '14px 40px',
              background: '#fff',
              color: '#1a1a5e',
              border: 'none',
              borderRadius: 50,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '1.5px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
            }}
          >
            预约参观学校
          </button>
        </section>

        {/* Bottom spacer */}
        <div style={{ height: 32 }} />
      </div>
      </div>
    </div>
  );
}
