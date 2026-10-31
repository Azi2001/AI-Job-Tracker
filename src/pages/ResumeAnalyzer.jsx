
import { useState } from 'react'

function ResumeAnalyzer() {
  const [jobDescription, setJobDescription] = useState('')
  const [resumeFile, setResumeFile] = useState(null)

  function handleSubmit(event) {
    event.preventDefault()

    if (!resumeFile) {
      alert('Please upload your resume.')
      return
    }

    if (!jobDescription.trim()) {
      alert('Please enter the job description.')
      return
    }

    alert('Your resume and job description are ready for analysis!')
  }

  return (
    <div className="resume-analyzer">
      <header>
        <h1>AI Resume Analyzer</h1>
        <p>
          Compare your resume with a job description and discover
          opportunities to improve your application.
        </p>
      </header>

      <form onSubmit={handleSubmit}>
        <section>
          <h2>1. Upload your resume</h2>
          <p>Select your resume in PDF format.</p>

          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) =>
              setResumeFile(event.target.files?.[0] ?? null)
            }
          />

          {resumeFile && (
            <p>Selected file: {resumeFile.name}</p>
          )}
        </section>

        <section>
          <h2>2. Add the job description</h2>
          <textarea
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the job description here..."
            rows={8}
            required
          />
        </section>

        <button type="submit">Analyze Resume</button>
      </form>
    </div>
  )
}

export default ResumeAnalyzer
