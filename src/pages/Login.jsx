
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { saveToken } from '../auth'

const API_URL = 'http://127.0.0.1:8000'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed. Please check your details.')
      }

      saveToken(data.access_token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? 'Could not connect to the server. Check that your backend is running.'
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

 
return (
  <main className="auth-page">
    {/* LEFT SIDE - NAVY IMAGE PANEL */}
    <section className="auth-visual">
      <div className="auth-brand">
        <div className="auth-logo">JT</div>
        <span>Job Tracker</span>
      </div>

      <div className="auth-visual-content">
        <h2>
          Your career journey,
          <br />
          organized.
        </h2>

        <p>
          Take control of your job search. Track applications,
          prepare for opportunities, and move closer to your
          dream career.
        </p>

        <div className="auth-features">
          <span className="auth-feature">Track Applications</span>
          <span className="auth-feature">Analyze Resumes</span>
          <span className="auth-feature">Achieve Goals</span>
        </div>
      </div>

      <p className="auth-visual-footer">
        YOUR CAREER JOURNEY STARTS HERE
      </p>
    </section>

    {/* RIGHT SIDE - LOGIN FORM */}
    <section className="auth-form-panel">
      <section className="auth-card">
        <p className="auth-eyebrow">WELCOME BACK</p>
        <h1>Sign in to your account</h1>
        <p className="auth-description">
          Keep your job search organized and moving forward.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </section>
    </section>
  </main>
)

}
