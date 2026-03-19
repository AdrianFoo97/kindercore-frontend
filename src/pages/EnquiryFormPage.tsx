import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  fontSize: 15,
  fontFamily: 'inherit',
  color: '#1e293b',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#475569',
  marginBottom: 4,
};

const helperStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: '#94a3b8',
  marginBottom: 6,
};

export default function EnquiryFormPage() {
  const [searchParams] = useSearchParams();
  const ctaSource = searchParams.get('from') || '';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    childName: '', parentPhone: '', childDob: '', enrolmentYear: new Date().getFullYear(),
    relationship: '', programme: '', howDidYouKnow: '', preferredAppointmentTime: '', addressLocation: '', needsTransport: null as boolean | null,
  });
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [addressOther, setAddressOther] = useState(false);
  const [sourceOther, setSourceOther] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [dobError, setDobError] = useState('');
  const [ageError, setAgeError] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [relationError, setRelationError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [programmeError, setProgrammeError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [transportError, setTransportError] = useState('');
  const [sourceError, setSourceError] = useState('');

  const validateAge = (dob: string, year: number) => {
    if (!dob) { setAgeError(''); return; }
    const birthYear = new Date(dob).getFullYear();
    const age = year - birthYear;
    if (age < 3) {
      const earliestYear = birthYear + 3;
      setAgeError(`目前年龄较小，本校目前接受 3 岁以上孩子\n建议选择 ${earliestYear} 年或之后的入学年份`);
    } else if (age > 6) {
      setAgeError('入学时年龄超过 6 岁，请确认出生日期与入学年份是否正确');
    } else {
      setAgeError('');
    }
  };

  const nextStep = () => {
    setError('');
    setDobError('');
    setAgeError('');
    setNameError('');
    setPhoneError('');
    setRelationError('');
    setAddressError('');
    setProgrammeError('');
    setTimeError('');
    setTransportError('');
    setSourceError('');
    let hasError = false;
    if (step === 1) {
      if (!form.childName) {
        setNameError('请填写孩子的名字');
        hasError = true;
      }
      if (!form.childDob) {
        setDobError('请填写出生日期');
        hasError = true;
      } else {
        const birthYear = new Date(form.childDob).getFullYear();
        const age = form.enrolmentYear - birthYear;
        if (age < 3) {
          const earliestYear = birthYear + 3;
          setAgeError(`目前年龄较小，本校目前接受 3 岁以上孩子\n建议选择 ${earliestYear} 年或之后的入学年份`);
          hasError = true;
        }
        if (age > 6) {
          setAgeError('孩子入学时已超龄，建议选择更早的入学年份');
          hasError = true;
        }
      }
      if (!form.programme) {
        setProgrammeError('请选择感兴趣的课程');
        hasError = true;
      }
      if (hasError) return;
    }
    if (step === 2) {
      if (!form.parentPhone) {
        setPhoneError('请填写联系电话');
        hasError = true;
      } else {
        const phone = form.parentPhone.replace(/[-\s]/g, '');
        const isMY = /^(\+?60|0)(1[0-9]{8,9}|[3-9][0-9]{7,8})$/.test(phone);
        const isSG = /^(\+?65)?[689][0-9]{7}$/.test(phone);
        if (!isMY && !isSG) {
          setPhoneError('请输入有效的电话号码');
          hasError = true;
        }
      }
      if (!form.relationship) {
        setRelationError('请选择');
        hasError = true;
      }
      if (!form.addressLocation) {
        setAddressError('请选择您所在的区域');
        hasError = true;
      }
      if (hasError) return;
    }
    setStep(s => s + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    setError('');
    setTimeError('');
    setTransportError('');
    setSourceError('');
    let hasError = false;
    if (!form.preferredAppointmentTime) {
      setTimeError('请选择');
      hasError = true;
    }
    if (form.needsTransport === null) {
      setTransportError('请选择');
      hasError = true;
    }
    if (!form.howDidYouKnow) {
      setSourceError('请选择');
      hasError = true;
    }
    if (hasError) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(Object.entries({
          ...form,
          preferredAppointmentTime: form.preferredAppointmentTime,
          ...(ctaSource ? { ctaSource } : {}),
        }).filter(([k, v]) => k === 'needsTransport' ? true : v !== ''))),
      });
      if (!res.ok) throw new Error('提交失败，请稍后重试');
      setSubmitted(true);
    } catch (err: unknown) {
      setError('提交失败，请稍后再试或直接 WhatsApp 联系我们');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'Noto Sans SC', 'Inter', system-ui, -apple-system, sans-serif",
      background: '#f0f4f8',
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh' }}>

        {/* Back button — hide on success */}
        {!submitted && (
          <div style={{ padding: '16px 24px 0' }}>
            <button
              onClick={() => step > 1 ? prevStep() : window.history.back()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                color: '#64748b',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              &larr; {step > 1 ? '上一步' : '返回'}
            </button>
          </div>
        )}

        {/* Hero intro */}
        {!submitted && (
          <div style={{ padding: '20px 24px 16px', textAlign: 'center' }}>
            <img
              src="/logo.png"
              alt="Ten Toes Preschool"
              style={{ height: 44, marginBottom: 10, objectFit: 'contain' }}
            />
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b', lineHeight: 1.5 }}>
              预约参观
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
              亲自看看，孩子在这里是怎么学习的
            </p>
          </div>
        )}

        {/* Progress bar */}
        {!submitted && (
          <div style={{ padding: '16px 24px 0' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3].map(s => (
                <div
                  key={s}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background: s <= step ? '#3c339a' : '#e2e8f0',
                    transition: 'background 0.3s',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              {['孩子资料', '联系方式', '完成预约'].map((label, i) => (
                <span key={i} style={{
                  fontSize: 11,
                  color: i + 1 === step ? '#3c339a' : '#c0c5cc',
                  fontWeight: i + 1 === step ? 600 : 400,
                  transition: 'color 0.3s',
                }}>
                  {i + 1}. {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {submitted ? (
          <div style={{ padding: '24px 24px 32px' }}>
            {/* Logo + Success */}
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <img
                src="/logo.png"
                alt="Ten Toes Preschool"
                style={{ height: 36, marginBottom: 16, objectFit: 'contain' }}
              />
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: '#16a34a',
                fontSize: 20,
              }}>
                <FontAwesomeIcon icon={faCircleCheck} />
              </div>
              <p style={{ fontSize: 19, fontWeight: 700, color: '#1e293b', margin: '0 0 3px' }}>
                预约成功
              </p>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                您的参观名额已为您保留
              </p>
            </div>

            {/* Next steps — numbered timeline */}
            <div style={{
              background: '#fff',
              borderRadius: 14,
              padding: '22px 20px',
              boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
              border: '1px solid #f1f5f9',
              marginBottom: 22,
            }}>
              <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#3c339a' }}>
                接下来会发生什么
              </p>

              {/* Step 1 */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#3c339a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>1</div>
                  <div style={{ width: 1, flex: 1, background: '#e2e8f0', margin: '4px 0' }} />
                </div>
                <div style={{ paddingBottom: 4 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                    WhatsApp 联系您
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                    我们将在 5 天内通过 WhatsApp 联系您，请留意手机信息
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e0e7ff', color: '#3c339a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>2</div>
                  <div style={{ width: 1, flex: 1, background: '#e2e8f0', margin: '4px 0' }} />
                </div>
                <div style={{ paddingBottom: 4 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                    确认参观时间
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                    为您安排最合适的参观时段
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e0e7ff', color: '#3c339a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>3</div>
                </div>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                    到校一对一参观
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                    园长亲自带您了解课程与学习环境
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: '#f1f5f9', margin: '16px 0' }} />

              {/* Visit benefits */}
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
                参观当天您将了解
              </p>
              {[
                '学校环境与学习氛围',
                '教学方式与孩子的学习体验',
                '课程安排与费用说明',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < 2 ? 5 : 0 }}>
                  <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 9, color: '#a5b4fc', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#64748b' }}>{item}</span>
                </div>
              ))}
            </div>

            {/* Closing */}
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                期待见到您和孩子
              </p>
            </div>
          </div>
        ) : (
          <div style={{
            margin: '12px 24px',
            background: '#fff',
            borderRadius: 16,
            padding: '24px 20px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            textAlign: 'left',
          }}>
            {/* Honeypot */}
            <div style={{ position: 'absolute', left: -9999, opacity: 0 }} aria-hidden="true">
              <input type="text" name="company" tabIndex={-1} autoComplete="off" />
            </div>

            {/* Step 1: Child Info */}
            {step === 1 && (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>孩子姓名 *</label>
                  <input
                    type="text"
                    value={form.childName}
                    onChange={e => { const v = e.target.value.replace(/[0-9]/g, ''); setForm(f => ({ ...f, childName: v })); setNameError(''); }}
                    placeholder="请输入孩子姓名"
                    style={{ ...inputStyle, ...(nameError ? { borderColor: '#ef4444' } : {}) }}
                  />
                  {nameError && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>&#9888; {nameError}</p>
                  )}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>出生日期 *</label>
                  <span style={helperStyle}>用于安排合适的班级</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={dobDay}
                      onChange={e => {
                        setDobDay(e.target.value); setDobError('');
                        if (e.target.value && dobMonth && dobYear) {
                          const dob = `${dobYear}-${dobMonth.padStart(2, '0')}-${e.target.value.padStart(2, '0')}`;
                          setForm(f => ({ ...f, childDob: dob })); validateAge(dob, form.enrolmentYear);
                        }
                      }}
                      style={{ ...inputStyle, flex: 1, appearance: 'auto', ...(dobError ? { borderColor: '#ef4444' } : {}) }}
                    >
                      <option value="">日</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d.toString()}>{d}</option>
                      ))}
                    </select>
                    <select
                      value={dobMonth}
                      onChange={e => {
                        setDobMonth(e.target.value); setDobError('');
                        if (dobDay && e.target.value && dobYear) {
                          const dob = `${dobYear}-${e.target.value.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;
                          setForm(f => ({ ...f, childDob: dob })); validateAge(dob, form.enrolmentYear);
                        }
                      }}
                      style={{ ...inputStyle, flex: 1, appearance: 'auto', ...(dobError ? { borderColor: '#ef4444' } : {}) }}
                    >
                      <option value="">月</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m.toString()}>{m}月</option>
                      ))}
                    </select>
                    <select
                      value={dobYear}
                      onChange={e => {
                        setDobYear(e.target.value); setDobError('');
                        if (dobDay && dobMonth && e.target.value) {
                          const dob = `${e.target.value}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;
                          setForm(f => ({ ...f, childDob: dob })); validateAge(dob, form.enrolmentYear);
                        }
                      }}
                      style={{ ...inputStyle, flex: 1, appearance: 'auto', ...(dobError ? { borderColor: '#ef4444' } : {}) }}
                    >
                      <option value="">年</option>
                      {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y.toString()}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {dobError && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444', whiteSpace: 'pre-line' }}>&#9888; {dobError}</p>
                  )}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>预计入学年份</label>
                  <select
                    value={form.enrolmentYear}
                    onChange={e => { const yr = Number(e.target.value); setForm(f => ({ ...f, enrolmentYear: yr })); validateAge(form.childDob, yr); }}
                    style={{ ...inputStyle, appearance: 'auto', ...(ageError ? { borderColor: '#ef4444' } : {}) }}
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  {ageError && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444', whiteSpace: 'pre-line' }}>&#9888; {ageError}</p>
                  )}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>感兴趣的课程</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                    {[
                      { value: 'Core', name: '日常课程', nameEn: 'Core Programme', time: '8:30am – 12:30pm', desc: '建立基础学习能力', price: '约 RM600 / 月起' },
                      { value: 'Core+Music', name: '日常 + 音乐课程', nameEn: 'Core + Music', time: '8:30am – 2:30pm', desc: '在音乐中表达与建立自信', price: '约 RM800 / 月起' },
                      { value: 'FullDay', name: 'Full Day 学习生活', nameEn: 'Full Day Programme', time: '8:30am – 5:30pm', desc: '在完整的一天中持续学习与成长', price: '约 RM1100 / 月起' },
                    ].map(opt => (
                      <label
                        key={opt.value}
                        onClick={() => { setForm(f => ({ ...f, programme: opt.value })); setProgrammeError(''); }}
                        style={{
                          display: 'block',
                          padding: '12px 14px',
                          borderRadius: 10,
                          border: `1.5px solid ${form.programme === opt.value ? '#3c339a' : '#d1d5db'}`,
                          background: form.programme === opt.value ? '#f0eeff' : '#fff',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: form.programme === opt.value ? '#3c339a' : '#1e293b' }}>
                            {opt.name}
                          </span>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {opt.time}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                          {opt.desc}
                        </p>
                      </label>
                    ))}
                  </div>
                  {programmeError && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>&#9888; {programmeError}</p>
                  )}
                </div>
              </>
            )}

            {/* Step 2: Contact Info */}
            {step === 2 && (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>您的联系电话 *</label>
                  <span style={helperStyle}>用于 WhatsApp 与您确认参观时间</span>
                  <input
                    type="tel"
                    value={form.parentPhone}
                    onChange={e => { const v = e.target.value.replace(/[^0-9+\-\s]/g, ''); setForm(f => ({ ...f, parentPhone: v })); setPhoneError(''); }}
                    placeholder="012-3456789"
                    style={{ ...inputStyle, ...(phoneError ? { borderColor: '#ef4444' } : {}) }}
                  />
                  {phoneError && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>&#9888; {phoneError}</p>
                  )}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>您是孩子的</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { label: '妈妈', value: 'Mother' },
                      { label: '爸爸', value: 'Father' },
                      { label: '其他', value: 'Other' },
                    ].map(opt => (
                      <label
                        key={opt.value}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '10px 0',
                          borderRadius: 8,
                          border: `1.5px solid ${form.relationship === opt.value ? '#3c339a' : '#d1d5db'}`,
                          background: form.relationship === opt.value ? '#f0eeff' : '#fff',
                          color: form.relationship === opt.value ? '#3c339a' : '#475569',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="radio"
                          name="relationship"
                          checked={form.relationship === opt.value}
                          onChange={() => { setForm(f => ({ ...f, relationship: opt.value })); setRelationError(''); }}
                          style={{ display: 'none' }}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  {relationError && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>&#9888; {relationError}</p>
                  )}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>您所在的区域</label>
                  <select
                    value={addressOther ? 'Others' : form.addressLocation}
                    onChange={e => {
                      if (e.target.value === 'Others') {
                        setAddressOther(true);
                        setForm(f => ({ ...f, addressLocation: '' }));
                        setAddressError('');
                      } else {
                        setAddressOther(false);
                        setForm(f => ({ ...f, addressLocation: e.target.value }));
                        setAddressError('');
                      }
                    }}
                    style={{ ...inputStyle, appearance: 'auto' }}
                  >
                    <option value="">请选择</option>
                    <option value="Bukit Indah">Bukit Indah</option>
                    <option value="Nusa Bestari">Nusa Bestari</option>
                    <option value="Taman Perling">Taman Perling</option>
                    <option value="Horizon Hills">Horizon Hills</option>
                    <option value="Nusa Duta">Nusa Duta</option>
                    <option value="Iskandar Puteri">Iskandar Puteri</option>
                    <option value="Nusa Idaman">Nusa Idaman</option>
                    <option value="Others">其他</option>
                  </select>
                  {addressOther && (
                    <input
                      type="text"
                      value={form.addressLocation}
                      onChange={e => { setForm(f => ({ ...f, addressLocation: e.target.value })); setAddressError(''); }}
                      placeholder="请输入您的区域"
                      style={{ ...inputStyle, marginTop: 8 }}
                      autoFocus
                    />
                  )}
                  {addressError && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>&#9888; {addressError}</p>
                  )}
                </div>
              </>
            )}

            {/* Step 3: Preferences */}
            {step === 3 && (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>方便参观的时间</label>
                  <select
                    value={form.preferredAppointmentTime}
                    onChange={e => { setForm(f => ({ ...f, preferredAppointmentTime: e.target.value })); setTimeError(''); }}
                    style={{ ...inputStyle, appearance: 'auto', ...(timeError ? { borderColor: '#ef4444' } : {}) }}
                  >
                    <option value="">请选择</option>
                    <optgroup label="平日">
                      <option value="Tuesday 3:30pm-4:30pm">星期二 3:30pm – 4:30pm</option>
                      <option value="Thursday 3:30pm-4:30pm">星期四 3:30pm – 4:30pm</option>
                    </optgroup>
                    <optgroup label="周末">
                      <option value="Saturday 1:00pm-2:00pm">星期六 1:00pm – 2:00pm</option>
                      <option value="Saturday 2:30pm-3:30pm">星期六 2:30pm – 3:30pm</option>
                    </optgroup>
                  </select>
                  {timeError && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>&#9888; {timeError}</p>
                  )}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>需要校车服务吗</label>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    {[
                      { label: '需要', value: true },
                      { label: '不需要', value: false },
                    ].map(opt => (
                      <label
                        key={String(opt.value)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '10px 0',
                          borderRadius: 8,
                          border: `1.5px solid ${form.needsTransport === opt.value ? '#3c339a' : '#d1d5db'}`,
                          background: form.needsTransport === opt.value ? '#f0eeff' : '#fff',
                          color: form.needsTransport === opt.value ? '#3c339a' : '#475569',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="radio"
                          name="transport"
                          checked={form.needsTransport === opt.value}
                          onChange={() => { setForm(f => ({ ...f, needsTransport: opt.value as boolean })); setTransportError(''); }}
                          style={{ display: 'none' }}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  {transportError && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>&#9888; {transportError}</p>
                  )}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>您是怎么知道我们的</label>
                  <select
                    value={sourceOther ? 'Others' : form.howDidYouKnow}
                    onChange={e => {
                      if (e.target.value === 'Others') {
                        setSourceOther(true);
                        setForm(f => ({ ...f, howDidYouKnow: '' }));
                        setSourceError('');
                      } else {
                        setSourceOther(false);
                        setForm(f => ({ ...f, howDidYouKnow: e.target.value }));
                        setSourceError('');
                      }
                    }}
                    style={{ ...inputStyle, appearance: 'auto' }}
                  >
                    <option value="">请选择</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Friend Referral">朋友介绍</option>
                    <option value="小红书">小红书</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Pass By">驾车经过</option>
                    <option value="Google">Google</option>
                    <option value="Sibling">其他孩子在就读</option>
                    <option value="Billboard">广告牌</option>
                    <option value="Others">其他</option>
                  </select>
                  {sourceOther && (
                    <input
                      type="text"
                      value={form.howDidYouKnow}
                      onChange={e => { setForm(f => ({ ...f, howDidYouKnow: e.target.value })); setSourceError(''); }}
                      placeholder="例：路过、小红书、朋友介绍"
                      style={{ ...inputStyle, marginTop: 8 }}
                      autoFocus
                    />
                  )}
                  {sourceError && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>&#9888; {sourceError}</p>
                  )}
                </div>
              </>
            )}

            {error && (
              <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 14px', textAlign: 'center' }}>
                {error}
              </p>
            )}

            {/* Navigation buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  style={{
                    flex: 1,
                    padding: '14px 0',
                    background: '#fff',
                    color: '#64748b',
                    border: '1.5px solid #d1d5db',
                    borderRadius: 50,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  上一步
                </button>
              )}
              <button
                type="button"
                onClick={step < 3 ? nextStep : handleSubmit}
                disabled={submitting}
                style={{
                  flex: step > 1 ? 1 : undefined,
                  width: step === 1 ? '100%' : undefined,
                  padding: '14px 0',
                  background: submitting ? '#94a3b8' : '#3c339a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 50,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '1px',
                  boxShadow: '0 4px 16px rgba(60, 51, 154, 0.25)',
                }}
              >
                {submitting ? '提交中...' : step < 3 ? '下一步' : '完成预约'}
              </button>
            </div>

          </div>
        )}

        {/* Bottom spacer */}
        {!submitted && <div style={{ height: 40 }} />}
      </div>
    </div>
  );
}
