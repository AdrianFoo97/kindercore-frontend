import { useNavigate } from 'react-router-dom';

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

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'Noto Sans SC', 'Inter', system-ui, -apple-system, sans-serif",
      background: '#f0f4f8',
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', overflow: 'hidden' }}>

        {/* ── Hero ── */}
        <section style={{
          background: 'linear-gradient(170deg, #2d2a6e 0%, #4a5faa 45%, #5a8abf 100%)',
          padding: '40px 24px 0',
          borderRadius: 0,
          textAlign: 'center' as const,
        }}>
          {/* Logo */}
          <img src="/logo.png" alt="Ten Toes" style={{ height: 48, marginBottom: 20 }} />

          {/* Eyebrow */}
          <p style={{
            margin: '0 0 16px',
            fontSize: 12,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '2px',
          }}>
            在孩子的成长过程中
          </p>

          {/* Headline */}
          <h1 style={{
            margin: '0 0 8px',
            fontSize: 20,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.7,
          }}>
            孩子最需要的，不是答案
            <br />
            而是自己会
          </h1>
          <p style={{
            margin: '0 0 28px',
            fontSize: 26,
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1.6,
          }}>
            主动去问、去试、去找到答案
          </p>

          {/* Image */}
          <div style={{
            width: 'calc(100% + 48px)',
            marginLeft: -24,
            aspectRatio: '16 / 10',
            background: 'linear-gradient(135deg, #d6dff0 0%, #c4d3e4 100%)',
            borderRadius: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img src="/hero.jpg" alt="孩子在学习中成长" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </section>

        {/* CTA */}
        <div style={{ textAlign: 'center' as const, padding: '20px 24px 0', position: 'relative', zIndex: 1 }}>
          <button
            onClick={() => navigate('/enquiry/form?from=hero')}
            style={{
              padding: '13px 36px',
              background: '#1a1a8e',
              color: '#fff',
              border: 'none',
              borderRadius: 50,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '1px',
              boxShadow: '0 4px 16px rgba(60, 51, 154, 0.25)',
            }}
          >
            预约参观学校
          </button>
        </div>

        {/* ── Story ── */}
        <section style={{
          margin: '20px 16px 0',
          padding: '32px 24px 36px',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          lineHeight: 1.9,
          fontSize: 15,
          color: '#475569',
          textAlign: 'center' as const,
        }}>
          <p style={{ margin: '0 0 28px' }}>
            在陪伴孩子成长的过程中，
            <br />
            我们慢慢有一个很深的感受。
          </p>
          <p style={{ margin: '0 0 28px' }}>
            以前我们会觉得，
            <br />
            孩子只要把 academic 学好，就够了。
          </p>
          <p style={{ margin: '0 0 28px' }}>
            在那个时候，
            <br />
            这样的方式，确实是有用的。
          </p>
          <p style={{ margin: '0 0 28px' }}>
            因为在以前，
            <br />
            答案并不容易找到，
            <br />
            会的越多，反而越有优势。
          </p>
          <p style={{ margin: '0 0 28px', color: '#1a1a8e', fontWeight: 700, fontSize: 18 }}>
            但现在不一样了
          </p>
          <p style={{ margin: '0 0 28px' }}>
            手机、Internet，甚至 AI，
            <br />
            让答案变得<span style={{ color: '#1a1a8e', fontWeight: 600 }}>随时都可以找到。</span>
          </p>
          <p style={{ margin: '0 0 28px' }}>
            也正因为这样，
            <br />
            如果孩子只是习惯记住答案，
          </p>
          <p style={{ margin: '0 0 28px' }}>
            当他遇到没有"现成答案"的问题时，
            <br />
            反而更容易卡住，不知道怎么办。
          </p>
          <p style={{ margin: '0 0 28px' }}>
            所以现在真正重要的，
            <br />
            已经不再是孩子知道多少，
          </p>
          <p style={{ margin: '0 0 28px' }}>
            而是当他不知道的时候，
            <br />
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a8e' }}>会不会去问、</span>
            <br />
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a8e' }}>会不会去尝试、</span>
            <br />
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a8e' }}>并且一步一步找到答案。</span>
          </p>
          <p style={{ margin: '0 0 28px' }}>
            所以在 Ten Toes，
            <br />
            我们更注重的是，
            <br />
            孩子在学习的过程中
          </p>
          <p style={{ margin: '0 0 20px' }}>
            当面对新事物时，
            <br />
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a8e' }}>愿不愿意主动去尝试</span>
          </p>
          <p style={{ margin: '0 0 20px' }}>
            当遇到困难时，
            <br />
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a8e' }}>会不会轻易放弃</span>
          </p>
          <p style={{ margin: '0 0 28px' }}>
            当遇到问题时，
            <br />
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a8e' }}>会不会自己去寻找答案。</span>
          </p>
          <p style={{ margin: '0 0 28px' }}>
            也因此，
            <br />
            我们更在意的，
          </p>
          <p style={{ margin: '0 0 8px' }}>
            是用怎样的学习方式，
            <br />
            让孩子慢慢学会
          </p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a8e' }}>
            去问、去试、去找到答案。
          </p>
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
          padding: '48px 24px',
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
        <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column' as const, gap: 16 }}>

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
          padding: '48px 24px',
          textAlign: 'center' as const,
          background: 'linear-gradient(180deg, #2d2a6e 0%, #1e1b54 100%)',
          color: 'rgba(255,255,255,0.7)',
          fontSize: 15,
          lineHeight: 1.9,
        }}>
          <p style={{ margin: '0 0 28px' }}>
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

          <p style={{ margin: '0 0 28px' }}>
            也正因为这样的学习方式，
            <br />
            孩子会慢慢变得更独立，
            <br />
            也更愿意自己尝试解决问题。
          </p>
          <p style={{ margin: '0 0 28px' }}>
            这些改变，
            <br />
            不只发生在学校。
          </p>
          <p style={{ margin: '0 0 28px' }}>
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
        }}>
          <h2 style={{ margin: '0 0 28px', fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
            家长的分享
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 20, padding: '0 24px' }}>
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
          padding: '56px 24px',
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
  );
}
