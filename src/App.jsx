
import { useState, useEffect } from 'react'
import { getAuthHeaders, clearToken } from './auth'
import './App.css'
import ReactMarkdown from 'react-markdown'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Applications from './pages/Applications'
import Register from './pages/Register'

const API_URL = 'http://127.0.0.1:8000'

function App() {
  const currentLocation = useLocation()
  const navigate = useNavigate()

  const currentPath = currentLocation.pathname
  const [applications, setApplications] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyIds, setBusyIds] = useState([])
  
  const [resumeFile, setResumeFile] = useState(null)
  const [jobDescription, setJobDescription] = useState('')
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchError, setMatchError] = useState('')
  const [matchReport, setMatchReport] = useState('')
  const [resumeAnalysis, setResumeAnalysis] = useState('')
  const [resumeLoading, setResumeLoading] = useState(false)
  const [resumeError, setResumeError] = useState('')
  const [resumeHistory, setResumeHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [preferredJobTitle, setPreferredJobTitle] = useState('')
  const [preferredLocation, setPreferredLocation] = useState('')
  const [preferredJobType, setPreferredJobType] = useState('Internship')
  const [preferencesLoading, setPreferencesLoading] = useState(false)

  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [status, setStatus] = useState('Applied')
  const [location, setLocation] = useState('')
  const [jobType, setJobType] = useState('Internship')

  const [theme, setTheme] = useState(
  () => localStorage.getItem('jobtrack-theme') || 'light'
)
useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('jobtrack-theme', theme)
}, [theme])


  useEffect(() => {
  if (
  currentLocation.pathname === '/login' ||
  currentLocation.pathname === '/register'
) {
  return
}
    
    async function fetchApplications() {
      try {
        const response = await fetch(`${API_URL}/applications`, {
  headers: getAuthHeaders(),
})  

        if (!response.ok) {
          throw new Error('Failed to load applications')
        }

        const data = await response.json()
            setApplications(data)

            setPreferredJobTitle(data.preferred_job_title || '')
            setPreferredLocation(data.preferred_location || '')
            setPreferredJobType(data.preferred_job_type || 'Internship')
      } catch (error) {
        console.error('Error loading applications:', error)
        alert('Could not load applications. Check that the backend is running.')
      } finally {
        setLoading(false)
      }
    }

   
    async function fetchProfile() {
      try {
        const response = await fetch(`${API_URL}/auth/profile`, {
          headers: getAuthHeaders(),
        })

        if (!response.ok) {
          throw new Error('Failed to load profile')
        }

        const data = await response.json()
        setProfile(data)
      } catch (error) {
        console.error('Error loading profile:', error)
      }
    }

    fetchApplications()
    fetchProfile()
  }, [currentLocation.pathname])

 useEffect(() => {
  if (
  currentLocation.pathname === '/login' ||
  currentLocation.pathname === '/register'
) {
  return
}

  loadResumeHistory()
}, [currentLocation.pathname])

  async function addApplication(event) {
    event.preventDefault()

    if (!company.trim() || !position.trim()) {
      alert('Please enter both company and position.')
      return
    }

    const newApplication = {
      company: company.trim(),
      position: position.trim(),
      status,
      location: location.trim(),
      job_type: jobType,
    }

    try {
      const response = await fetch(`${API_URL}/applications`, {
        method: 'POST',
       headers: getAuthHeaders({
  'Content-Type': 'application/json',
}),
        body: JSON.stringify(newApplication),
      })

      if (!response.ok) {
        throw new Error('Failed to save application')
      }

      const savedApplication = await response.json()

      setApplications((previous) => [...previous, savedApplication])

      setCompany('')
      setPosition('')
      setStatus('Applied')
      setLocation('')
      setJobType('Internship')
      setShowForm(false)
    } catch (error) {
      console.error('Error saving application:', error)
      alert('Could not save the application. Check that the backend is running.')
    }
  }
  
  async function analyzeResume(event) {
    event.preventDefault()

    if (!resumeFile) {
      setResumeError('Please select a PDF resume first.')
      return
    }

    setResumeLoading(true)
    setResumeError('')
    setResumeAnalysis('')

    try {
      const formData = new FormData()
      formData.append('file', resumeFile)

      const response = await fetch(`${API_URL}/resume/analyze`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Resume analysis failed.')
      }

      setResumeAnalysis(data.analysis)
      await loadResumeHistory()
    } catch (error) {
      console.error('Error analyzing resume:', error)
      setResumeError(
        error.message || 'Could not analyze the resume. Please try again.'
      )
    } finally {
      setResumeLoading(false)
    }
  }


async function matchResumeToJob(event) {
  event.preventDefault()

  if (!resumeFile) {
    setMatchError('Please select your PDF resume.')
    return
  }

  if (!jobDescription.trim()) {
    setMatchError('Please enter the job description.')
    return
  }

  setMatchLoading(true)
  setMatchError('')
  setMatchReport('')

  try {
    const formData = new FormData()
    formData.append('file', resumeFile)
    formData.append('job_description', jobDescription)

    const response = await fetch(`${API_URL}/resume/match`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || 'Resume matching failed.')
    }

    setMatchReport(data.match_report)
  } catch (error) {
    setMatchError(error.message || 'Could not compare your resume.')
  } finally {
    setMatchLoading(false)
  }
}


  
  async function loadResumeHistory() {
    setHistoryLoading(true)

    try {
      const response = await fetch(`${API_URL}/resume/history`, {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Could not load resume history.')
      }

      const data = await response.json()
      setResumeHistory(data)
    } catch (error) {
      console.error('Error loading resume history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

     function handleLogout() {
  clearToken()
  window.location.replace('/login')
}

async function editApplication(event) {
  event.preventDefault()

  if (!company.trim() || !position.trim()) {
    alert('Please enter both company and position.')
    return
  }

  const updatedApplication = {
    company: company.trim(),
    position: position.trim(),
    status,
    location: location.trim(),
    job_type: jobType,
  }

  try {
    const response = await fetch(`${API_URL}/applications/${editingId}`, {
      method: 'PATCH',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(updatedApplication),
    })

    if (!response.ok) {
      throw new Error('Failed to update application')
    }

    const savedApplication = await response.json()

    setApplications((previous) =>
      previous.map((application) =>
        application.id === editingId ? savedApplication : application
      )
    )

    setEditingId(null)
    setCompany('')
    setPosition('')
    setStatus('Applied')
    setLocation('')
    setJobType('Internship')
    setShowForm(false)
  } catch (error) {
    console.error('Error updating application:', error)
    alert('Could not update the application. Please try again.')
  }
}
  
function startEditing(application) {
  setEditingId(application.id)
  setCompany(application.company || '')
  setPosition(application.position || '')
  setStatus(application.status || 'Applied')
  setLocation(application.location || '')
  setJobType(application.job_type || application.jobType || 'Internship')
  setShowForm(true)

  window.scrollTo({ top: 0, behavior: 'smooth' })
}



  async function updateApplicationStatus(id, newStatus) {
    const previousApplication = applications.find(
      (application) => application.id === id
    )

    if (!previousApplication || previousApplication.status === newStatus) {
      return
    }

    setBusyIds((previous) => [...previous, id])

    try {
      const response = await fetch(`${API_URL}/applications/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders({
  'Content-Type': 'application/json',
}),
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update application status')
      }

      const updatedApplication = await response.json()

      setApplications((previous) =>
        previous.map((application) =>
          application.id === id ? updatedApplication : application
        )
      )
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Could not update the status. Please try again.')
    } finally {
      setBusyIds((previous) => previous.filter((itemId) => itemId !== id))
    }
  }

  async function deleteApplication(id) {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this application?'
    )

    if (!confirmDelete) {
      return
    }

    setBusyIds((previous) => [...previous, id])

    try {
      const response = await fetch(`${API_URL}/applications/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
})

      if (!response.ok) {
        throw new Error('Failed to delete application')
      }

      setApplications((previous) =>
        previous.filter((application) => application.id !== id)
      )
    } catch (error) {
      console.error('Error deleting application:', error)
      alert('Could not delete the application. Please try again.')
    } finally {
      setBusyIds((previous) => previous.filter((itemId) => itemId !== id))
    }
  }

  const interviewCount = applications.filter(
    (application) => application.status === 'Interview'
  ).length

  const offerCount = applications.filter(
    (application) => application.status === 'Offer'
  ).length
    
const rejectedCount = applications.filter(
  (application) => application.status === 'Rejected'
).length

const appliedCount = applications.filter(
  (application) => application.status === 'Applied'
).length

const inProgressCount = applications.filter(
  (application) =>
    application.status === 'Applied' ||
    application.status === 'Interview'
).length

const interviewRate =
  applications.length > 0
    ? Math.round((interviewCount / applications.length) * 100)
    : 0

const offerRate =
  applications.length > 0
    ? Math.round((offerCount / applications.length) * 100)
    : 0


const statusBreakdown = [
  { label: 'Applied', count: appliedCount, color: '#6366f1' },
  { label: 'Interview', count: interviewCount, color: '#0ea5e9' },
  { label: 'Offer', count: offerCount, color: '#10b981' },
  { label: 'Rejected', count: rejectedCount, color: '#f43f5e' },
]



  const filteredApplications = applications.filter((application) => {
    const search = searchTerm.toLowerCase()

    return (
      application.company.toLowerCase().includes(search) ||
      application.position.toLowerCase().includes(search)
    )
  })
    
async function uploadProfilePicture(event) {
  const file = event.target.files?.[0]
  event.target.value = ''

  if (!file) return

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    setProfileError('Please choose a JPG, PNG, or WebP image.')
    setProfileMessage('')
    return
  }

  if (file.size > 2 * 1024 * 1024) {
    setProfileError('The image must be 2 MB or smaller.')
    setProfileMessage('')
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  setProfileLoading(true)
  setProfileError('')
  setProfileMessage('')

  try {
    const response = await fetch(`${API_URL}/auth/profile/picture`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || 'Could not upload the picture.')
    }

    setProfile((previous) => ({
      ...previous,
      profile_picture: data.profile_picture,
    }))

    setProfileMessage('Profile picture updated successfully.')
  } catch (error) {
    setProfileError(error.message || 'Upload failed.')
  } finally {
    setProfileLoading(false)
  }
}
async function saveCareerPreferences(event) {
  event.preventDefault()

  setPreferencesLoading(true)
  setProfileError('')
  setProfileMessage('')

  try {
    const response = await fetch(`${API_URL}/auth/profile`, {
      method: 'PUT',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        preferred_job_title: preferredJobTitle.trim(),
        preferred_location: preferredLocation.trim(),
        preferred_job_type: preferredJobType,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || 'Could not update career preferences.')
    }

    setProfile((previous) => ({
      ...previous,
      preferred_job_title: data.preferred_job_title,
      preferred_location: data.preferred_location,
      preferred_job_type: data.preferred_job_type,
    }))

    setProfileMessage('Career preferences saved successfully.')
  } catch (error) {
    setProfileError(error.message || 'Could not save career preferences.')
  } finally {
    setPreferencesLoading(false)
  }
}


if (currentLocation.pathname === '/login') {
  return <Login />
}
if (currentLocation.pathname === '/register') {
  return <Register />
}
const isDashboardPage =
  currentPath === '/' || currentPath === '/dashboard'
 return (
  <div className="dashboard-layout">
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">JT</div>
        <div>
          <strong>Job Tracker</strong>
          <span>CAREER WORKSPACE</span>
        </div>
      </div>

      <p className="sidebar-label">WORKSPACE</p>

     
<nav className="sidebar-nav">
  <Link
    className={`sidebar-link ${currentLocation.pathname === '/dashboard' ? 'active' : ''}`}
    to="/dashboard"
  >
    <span>▦</span> Dashboard
  </Link>

  <Link
    className={`sidebar-link ${currentLocation.pathname === '/applications' ? 'active' : ''}`}
    to="/applications"
  >
    <span>▤</span> My Applications
  </Link>

  <Link
    className={`sidebar-link ${currentLocation.pathname === '/resume-analyzer' ? 'active' : ''}`}
    to="/resume-analyzer"
  >
    <span>◇</span> Resume Analyzer
  </Link>

  <Link
    className={`sidebar-link ${currentLocation.pathname === '/profile' ? 'active' : ''}`}
    to="/profile"
  >
    <span>◎</span> My Profile
  </Link>
<Link
  className={`sidebar-link ${currentLocation.pathname === '/settings' ? 'active' : ''}`}
  to="/settings"
>
  <span>⚙</span> Settings
</Link>

</nav>


      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
  {profile?.profile_picture ? (
    <img
      src={`${API_URL}${profile.profile_picture}`}
      alt="Profile"
      className="sidebar-avatar-image"
    />
  ) : (
    <span>
      {profile?.full_name
        ? profile.full_name.trim().charAt(0).toUpperCase()
        : 'U'}
    </span>
  )}
</div>
          <div className="sidebar-user-info">
            <strong>{profile?.full_name || 'My Workspace'}</strong>
            <span>{profile?.email || 'Job seeker'}</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          ↪ Sign out
        </button>
      </div>
    </aside>

    <main className="dashboard-main">

      <div className="app">
        {isDashboardPage && (
  <>
      <header className="header">
        <div>
          <h1>Job Application Tracker</h1>
          <p>Track your job search journey in one place.</p>
        </div>

        <button
  className="add-button"
  onClick={() => {
    setEditingId(null)
    setShowForm(true)
    navigate('/applications')
  }}
>
  + Add Application
</button>

      </header>

      
<section className="summary">
  <div className="summary-card">
    <p>Total Applications</p>
    <h2>{applications.length}</h2>
    <span>All your job applications</span>
  </div>

  <div className="summary-card">
    <p>Interviews</p>
    <h2>{interviewCount}</h2>
    <span>{interviewRate}% of applications</span>
  </div>

  <div className="summary-card">
    <p>Offers</p>
    <h2>{offerCount}</h2>
    <span>{offerRate}% of applications</span>
  </div>

  <div className="summary-card">
    <p>Applied</p>
    <h2>{appliedCount}</h2>
    <span>Awaiting a response</span>
  </div>

  <div className="summary-card">
    <p>Rejected</p>
    <h2>{rejectedCount}</h2>
    <span>Applications declined</span>
  </div>

  <div className="summary-card">
    <p>In Progress</p>
    <h2>{inProgressCount}</h2>
    <span>Applied or interviewing</span>
  </div>
</section>

<section className="status-breakdown">
  <div className="status-breakdown-heading">
    <div>
      <h2>Application Status</h2>
      <p>See how your job search is progressing.</p>
    </div>
    <span>{applications.length} total</span>
  </div>

  {statusBreakdown.map((item) => {
    const percentage =
      applications.length > 0
        ? Math.round((item.count / applications.length) * 100)
        : 0

    return (
      <div className="breakdown-item" key={item.label}>
        <div className="breakdown-label">
          <span>{item.label}</span>
          <span>{item.count} · {percentage}%</span>
        </div>

        <div
          className="breakdown-track"
          role="progressbar"
          aria-label={`${item.label} applications`}
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="breakdown-fill"
            style={{
              width: `${percentage}%`,
              backgroundColor: item.color,
            }}
          />
        </div>
      </div>
    )
  })}
</section>
         
<section className="insights-section">
  <h2>Job Search Insights</h2>
  <p className="insights-description">
    Understand how your applications are progressing.
  </p>

  <div className="insights-grid">
    <div className="insight-card">
      <div className="insight-icon interview-icon">↗</div>
      <div>
        <p>Interview Rate</p>
        <h3>{interviewRate}%</h3>
        <span>
          {interviewCount} of {applications.length} applications
        </span>
      </div>
    </div>

    <div className="insight-card">
      <div className="insight-icon offer-icon">✓</div>
      <div>
        <p>Offer Rate</p>
        <h3>{offerRate}%</h3>
        <span>
          {offerCount} of {applications.length} applications
        </span>
      </div>
    </div>
  </div>
</section>

</>
)}
{currentPath === '/resume-analyzer' && (
  <>
<section className="resume-analyzer-section" id="resume-analyzer">
  <div className="resume-analyzer-heading"> 
    <div>
      <h2>AI Resume Analyzer</h2>
      <p>
        Upload your PDF resume to receive personalized feedback
        on your skills, strengths, and areas for improvement.
      </p>
    </div>
    <span className="resume-ai-badge">AI Powered</span>
  </div>

  <form onSubmit={analyzeResume} className="resume-upload-form">
    <label htmlFor="resume-file">Choose your resume (PDF, max 5 MB)</label>

    <input
      id="resume-file"
      type="file"
      accept=".pdf,application/pdf"
      onChange={(event) => {
        setResumeFile(event.target.files?.[0] || null)
        setResumeError('')
        setResumeAnalysis('')
      }}
    />

    {resumeFile && (
      <p className="resume-file-name">
        Selected file: {resumeFile.name}
      </p>
    )}

    <button
      className="add-button"
      type="submit"
      disabled={resumeLoading || !resumeFile}
    >
      {resumeLoading ? 'Analyzing Resume...' : 'Analyze Resume'}
    </button>
  </form>

  {resumeLoading && (
  <p className="resume-loading" role="status">
    Analyzing your resume with local AI. This may take a minute or two.
    Please keep this page open.
  </p>
)}

  {resumeError && (
    <p className="resume-error" role="alert">
      {resumeError}
    </p>
  )}

  {resumeAnalysis && (
    <div className="resume-analysis-result">
      <h3>Resume Analysis Results</h3>
      <div className="resume-analysis-content">
  <ReactMarkdown>{resumeAnalysis}</ReactMarkdown>
</div>
    </div>
  )}
</section>
    
<section className="matcher-section">
  <div className="matcher-heading">
    <div>
      <h2>Resume–Job Description Matcher</h2>
      <p>
        Discover how well your resume matches a specific job opportunity.
      </p>
    </div>
    <span className="resume-ai-badge">AI Powered</span>
  </div>

  <form onSubmit={matchResumeToJob} className="matcher-form">
    <label htmlFor="matcher-resume">
      Select your resume (PDF, max 5 MB)
    </label>

    <input
      id="matcher-resume"
      type="file"
      accept=".pdf,application/pdf"
      onChange={(event) => {
        setResumeFile(event.target.files?.[0] || null)
        setMatchError('')
        setMatchReport('')
      }}
    />

    <label htmlFor="job-description">
      Paste the job description
    </label>

    <textarea
      id="job-description"
      rows="8"
      placeholder="Paste the full job description here..."
      value={jobDescription}
      onChange={(event) => setJobDescription(event.target.value)}
    />

    <button
      type="submit"
      className="add-button"
      disabled={matchLoading || !resumeFile || !jobDescription.trim()}
    >
      {matchLoading ? 'Comparing Resume...' : 'Match My Resume'}
    </button>
  </form>

  {matchLoading && (
    <p className="resume-loading" role="status">
      Comparing your resume with the job description using local AI.
      Please keep this page open.
    </p>
  )}

  {matchError && (
    <p className="resume-error" role="alert">
      {matchError}
    </p>
  )}

  {matchReport && (
    <div className="matcher-results">
      <h3>Resume Match Report</h3>
      <div className="resume-analysis-content">
        <ReactMarkdown>{matchReport}</ReactMarkdown>
      </div>
    </div>
  )}
</section>

<section className="resume-history-section" id="resume-history">
  <div className="resume-history-heading">
    <div>
      <h2>Resume Analysis History</h2>
      <p>View and revisit your previous resume reports.</p>
    </div>
    <button
      type="button"
      className="edit-button"
      onClick={loadResumeHistory}
      disabled={historyLoading}
    >
      {historyLoading ? 'Loading...' : 'Refresh History'}
    </button>
  </div>

  {historyLoading ? (
    <p className="empty-message">Loading your saved reports...</p>
  ) : resumeHistory.length === 0 ? (
    <p className="empty-message">
      No saved analyses yet. Analyze a resume to see it here.
    </p>
  ) : (
    <div className="resume-history-list">
      {resumeHistory.map((item) => (
        <div className="resume-history-item" key={item.id}>
          <div className="resume-history-details">
            <strong>{item.filename}</strong>
            <span>
              {item.created_at
                ? new Date(item.created_at).toLocaleString()
                : 'Date unavailable'}
            </span>
          </div>

          <button
            type="button"
            className="edit-button"
            onClick={() => {
              setResumeAnalysis(item.analysis)
              setResumeError('')
              document
                .getElementById('resume-analyzer')
                ?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            View Report
          </button>
        </div>
      ))}
    </div>
  )}
</section>
       </>
)}
{currentPath === '/profile' && (
  <>
<section id="profile" className="profile-section">
  <div className="profile-heading">
    <h2>My Profile</h2>
    <p>Manage your account details and career preferences.</p>
  </div>

  {/* Personal information */}
  <div className="profile-card">
    <div className="profile-preview">
      {profile?.profile_picture ? (
        <img
          src={`${API_URL}${profile.profile_picture}`}
          alt="Your profile"
          className="profile-picture-preview"
        />
      ) : (
        <div className="profile-default-avatar">
          {profile?.full_name
            ? profile.full_name.trim().charAt(0).toUpperCase()
            : 'U'}
        </div>
      )}
    </div>

    <div className="profile-details">
      <h3>{profile?.full_name || 'Your Name'}</h3>
      <p>{profile?.email || 'Your email'}</p>

      <label className="profile-upload-button">
        {profileLoading ? 'Uploading...' : 'Upload / Change Picture'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={uploadProfilePicture}
          disabled={profileLoading}
          hidden
        />
      </label>
    </div>
  </div>

  {/* Career preferences */}
  <div className="profile-preferences-card">
    <h3>Career Preferences</h3>
    <p>Tell us what kind of opportunities you're looking for.</p>

    <form onSubmit={saveCareerPreferences}>
      <div className="profile-form-group">
        <label htmlFor="preferredJobTitle">Preferred Job Title</label>
        <input
          id="preferredJobTitle"
          type="text"
          placeholder="e.g. Full Stack Developer"
          value={preferredJobTitle}
          onChange={(event) => setPreferredJobTitle(event.target.value)}
        />
      </div>

      <div className="profile-form-group">
        <label htmlFor="preferredLocation">Preferred Location</label>
        <input
          id="preferredLocation"
          type="text"
          placeholder="e.g. Colombo"
          value={preferredLocation}
          onChange={(event) => setPreferredLocation(event.target.value)}
        />
      </div>

      <div className="profile-form-group">
        <label htmlFor="preferredJobType">Preferred Job Type</label>
        <select
          id="preferredJobType"
          value={preferredJobType}
          onChange={(event) => setPreferredJobType(event.target.value)}
        >
          <option value="Internship">Internship</option>
          <option value="Full-time">Full-time</option>
          <option value="Part-time">Part-time</option>
          <option value="Contract">Contract</option>
          <option value="Remote">Remote</option>
        </select>
      </div>

      <button
        type="submit"
        className="profile-save-button"
        disabled={preferencesLoading}
      >
        {preferencesLoading ? 'Saving...' : 'Save Preferences'}
      </button>
    </form>

    {profileError && (
      <p className="profile-error">{profileError}</p>
    )}

    {profileMessage && (
      <p className="profile-message">{profileMessage}</p>
    )}
  </div>
</section>
</>
)}

{currentPath === '/settings' && (
  <section className="settings-section">
    <div className="settings-heading">
      <h2>Settings</h2>
      <p>Personalize your Job Tracker workspace.</p>
    </div>

    <div className="settings-card">
      <div className="settings-item">
        <div>
          <h3>Appearance</h3>
          <p>Choose the theme that feels comfortable for you.</p>
        </div>

        <div className="theme-options">
          <button
            type="button"
            className={theme === 'light' ? 'theme-option selected' : 'theme-option'}
            onClick={() => setTheme('light')}
          >
            ☀ Light
          </button>

          <button
            type="button"
            className={theme === 'dark' ? 'theme-option selected' : 'theme-option'}
            onClick={() => setTheme('dark')}
          >
            ☾ Dark
          </button>
        </div>
      </div>

      <div className="settings-note">
        Your appearance preference is saved automatically.
      </div>
    </div>
  </section>
)}

{currentPath === '/applications' && (
  <>
      {showForm && (
  <section className="applications-section">
    <h2>{editingId !== null ? 'Edit Job Application' : 'Add a Job Application'}</h2>
    <form onSubmit={editingId !== null ? editApplication : addApplication}>
            <label>
              Company
              <input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="e.g. ABC Software"
                required
              />
            </label>

            <label>
              Position
              <input
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder="e.g. Software Engineering Intern"
                required
              />
            </label>

            <label>
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option>Applied</option>
                <option>Interview</option>
                <option>Rejected</option>
                <option>Offer</option>
              </select>
            </label>

            <label>
              Location
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="e.g. Colombo"
              />
            </label>

            <label>
              Job Type
              <select
                value={jobType}
                onChange={(event) => setJobType(event.target.value)}
              >
                <option>Internship</option>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Remote</option>
                <option>Contract</option>
              </select>
            </label>

            <button className="add-button" type="submit">
              {editingId !== null ? 'Save Changes' : 'Save Application'}
            </button>
          </form>
        </section>
      )}
             
<section className="applications-section" id="applications">
  <div className="applications-heading">
    <div>
      <h2>My Applications</h2>
      <p className="section-description">
        Track and manage your job opportunities.
      </p>
    </div>
    <span className="application-count">
      {filteredApplications.length} shown
    </span>
  </div>

  <input
    className="search-input"
    type="text"
    placeholder="Search by company or position..."
    value={searchTerm}
    onChange={(event) => setSearchTerm(event.target.value)}
    aria-label="Search applications"
  />

  {loading ? (
    <p className="empty-message">Loading applications...</p>
  ) : applications.length === 0 ? (
    <p className="empty-message">
      No applications yet. Add your first application to get started!
    </p>
  ) : filteredApplications.length === 0 ? (
    <p className="empty-message">No matching applications found.</p>
  ) : (
    <div className="applications-table-wrapper">
      <table className="applications-table">
        <thead>
          <tr>
            <th>COMPANY & POSITION</th>
            <th>LOCATION</th>
            <th>JOB TYPE</th>
            <th>STATUS</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {filteredApplications.map((application) => (
            <tr key={application.id}>
              <td>
                <div className="company-cell">
                  <div className="company-avatar">
                    {(application.company || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <strong>{application.company}</strong>
                    <span>{application.position}</span>
                  </div>
                </div>
              </td>
              <td>{application.location || 'Not specified'}</td>
              <td>
                {application.job_type || application.jobType || 'Not specified'}
              </td>
              <td>
                <div className="status-cell">
                  <span
                    className={`status-badge status-${String(
                      application.status
                    ).toLowerCase()}`}
                  >
                    {application.status}
                  </span>
                  <select
                    aria-label={`Change status for ${application.company}`}
                    value={application.status}
                    disabled={busyIds.includes(application.id)}
                    onChange={(event) =>
                      updateApplicationStatus(
                        application.id,
                        event.target.value
                      )
                    }
                  >
                    <option>Applied</option>
                    <option>Interview</option>
                    <option>Rejected</option>
                    <option>Offer</option>
                  </select>
                </div>
              </td>
              <td>
                
<button
  type="button"
  className="edit-button"
  disabled={busyIds.includes(application.id)}
  onClick={() => startEditing(application)}
>
  Edit
</button>

                <button
                  type="button"
                  className="delete-button" 
                  disabled={busyIds.includes(application.id)}
                  onClick={() => deleteApplication(application.id)}
                >
                  {busyIds.includes(application.id) ? 'Please wait...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</section>

       </>
)}
      </div>
    </main>
  </div>
  )
}
export default App
