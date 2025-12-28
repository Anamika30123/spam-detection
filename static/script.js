// DOM Elements
const navBtns = document.querySelectorAll(".nav-btn")
const sections = document.querySelectorAll(".section")
const analyzeForm = document.getElementById("analyzeForm")
const analysisResults = document.getElementById("analysisResults")
const closeResults = document.getElementById("closeResults")
const scrapeBtn = document.getElementById("scrapeBtn")
const searchBtn = document.getElementById("searchBtn")
const exportBtn = document.getElementById("exportBtn")
const articlesList = document.getElementById("articlesList")
const pagination = document.getElementById("pagination")

let currentPage = 1

// Navigation
navBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const section = btn.getAttribute("data-section")
    showSection(section)

    // Update active button
    navBtns.forEach((b) => b.classList.remove("active"))
    btn.classList.add("active")
  })
})

function showSection(sectionId) {
  sections.forEach((section) => section.classList.remove("active"))
  document.getElementById(sectionId).classList.add("active")

  // Load data for specific sections
  if (sectionId === "articles") {
    loadArticles(1)
  } else if (sectionId === "analytics") {
    loadAnalytics()
  }
}

// Analyze Form
analyzeForm.addEventListener("submit", async (e) => {
  e.preventDefault()

  const title = document.getElementById("title").value.trim()
  const content = document.getElementById("content").value.trim()
  const source = document.getElementById("source").value.trim() || "Manual Entry"
  const url = document.getElementById("url").value.trim()
  const category = document.getElementById("category").value

  if (!title || !content) {
    alert("Please fill in title and content")
    return
  }

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, url, source, category }),
    })

    const data = await response.json()
    displayResults(data)

    // Reset form
    analyzeForm.reset()
  } catch (error) {
    console.error("Error:", error)
    alert("Error analyzing article")
  }
})

function displayResults(data) {
  analysisResults.style.display = "block"

  const spamScore = data.spam_score
  const spamLevel = data.spam_level
  const credibility = data.credibility
  const details = data.details

  // Update score
  document.getElementById("spamScore").textContent = spamScore
  document.getElementById("meterFill").style.width = spamScore + "%"

  // Update classification
  document.getElementById("spamLevel").textContent = spamLevel.replace("_", " ").toUpperCase()
  document.getElementById("credibility").textContent = credibility + "%"

  // Update color based on score
  const spamScoreBox = document.querySelector(".score-box")
  if (spamScore < 20) {
    spamScoreBox.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)"
  } else if (spamScore < 40) {
    spamScoreBox.style.background = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
  } else {
    spamScoreBox.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
  }

  // Display details
  const detailsList = document.getElementById("detailsList")
  detailsList.innerHTML = ""

  for (const [key, value] of Object.entries(details)) {
    if (key === "word_count") continue

    let html = `<div class="detail-item">`
    html += `<div class="detail-category">${key.replace("_", " ")}</div>`

    if (Array.isArray(value)) {
      html += `<div class="detail-items">${value.join(", ")}</div>`
    } else if (typeof value === "boolean" && value) {
      html += `<div class="detail-items">Detected</div>`
    }
    html += `</div>`

    detailsList.innerHTML += html
  }

  // Recommendations
  const recommendations = []
  if (spamScore < 20) {
    recommendations.push("This article appears to be legitimate.")
    recommendations.push("Source is reliable for news consumption.")
  } else if (spamScore < 40) {
    recommendations.push("Exercise caution - some indicators suggest potential issues.")
    recommendations.push("Verify information with multiple sources.")
    recommendations.push("Check author credibility and publication date.")
  } else {
    recommendations.push("High spam probability detected!")
    recommendations.push("Do not share without verification.")
    recommendations.push("Cross-reference with trusted sources.")
    recommendations.push("Check for sensationalism or misleading claims.")
  }

  const recommendationsList = document.getElementById("recommendationsList")
  recommendationsList.innerHTML = recommendations.map((r) => `<li>${r}</li>`).join("")

  // Scroll to results
  setTimeout(() => {
    analysisResults.scrollIntoView({ behavior: "smooth" })
  }, 100)
}

closeResults.addEventListener("click", () => {
  analysisResults.style.display = "none"
})

// Scraper
scrapeBtn.addEventListener("click", async () => {
  scrapeBtn.disabled = true
  const status = document.getElementById("status")
  status.textContent = "Scraping articles..."
  status.classList.add("active")

  try {
    const response = await fetch("/api/scrape", { method: "POST" })
    const data = await response.json()

    status.textContent = `Scraped and analyzed ${data.count} articles`
    status.classList.remove("active")

    displayScrapeResults(data.articles)
  } catch (error) {
    console.error("Error:", error)
    status.textContent = "Error scraping articles"
  } finally {
    scrapeBtn.disabled = false
  }
})

function displayScrapeResults(articles) {
  const scrapeList = document.getElementById("scrapeList")
  const scrapeResults = document.getElementById("scrapeResults")

  scrapeList.innerHTML = ""
  articles.forEach((article) => {
    const item = document.createElement("div")
    item.className = "article-item"

    const badgeClass = "badge-" + article.spam_level.replace("_", "-")

    item.innerHTML = `
            <div class="article-title">${article.title}</div>
            <div class="article-meta">
                <span class="meta-item">📰 ${article.source}</span>
                <span class="meta-item">🏢 Credibility: ${article.credibility}%</span>
            </div>
            <div class="article-badges">
                <span class="badge ${badgeClass}">${article.spam_level.replace("_", " ")}</span>
            </div>
            <div class="article-stats">
                <div class="stat-row">
                    <span class="stat-name">Spam Score</span>
                    <span class="stat-val">${article.spam_score}/100</span>
                </div>
            </div>
        `
    scrapeList.appendChild(item)
  })

  scrapeResults.style.display = "block"
  scrapeResults.scrollIntoView({ behavior: "smooth" })
}

// Articles List
async function loadArticles(page = 1) {
  try {
    const response = await fetch(`/api/articles?page=${page}`)
    const data = await response.json()

    currentPage = page
    displayArticles(data.articles)
    displayPagination(data.pages, page)
  } catch (error) {
    console.error("Error:", error)
  }
}

function displayArticles(articles) {
  articlesList.innerHTML = ""

  if (articles.length === 0) {
    articlesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📄</div>
                <p>No articles found. Analyze some articles first!</p>
            </div>
        `
    return
  }

  articles.forEach((article) => {
    const item = document.createElement("div")
    item.className = "article-item"

    const badgeClass = "badge-" + article.Spam_Level.replace("_", "-")

    item.innerHTML = `
            <div class="article-title">${article.Title}</div>
            <div class="article-meta">
                <span class="meta-item">📰 ${article.Source}</span>
                <span class="meta-item">📂 ${article.Category}</span>
                <span class="meta-item">📅 ${new Date(article.Timestamp).toLocaleDateString()}</span>
            </div>
            <div class="article-badges">
                <span class="badge ${badgeClass}">${article.Spam_Level.replace("_", " ")}</span>
            </div>
            <div class="article-stats">
                <div class="stat-row">
                    <span class="stat-name">Spam Score</span>
                    <span class="stat-val">${article.Spam_Score}/100</span>
                </div>
                <div class="stat-row">
                    <span class="stat-name">Credibility</span>
                    <span class="stat-val">${article.Credibility}%</span>
                </div>
            </div>
        `
    articlesList.appendChild(item)
  })
}

function displayPagination(pages, currentPage) {
  pagination.innerHTML = ""

  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement("button")
    btn.className = "page-btn" + (i === currentPage ? " active" : "")
    btn.textContent = i
    btn.addEventListener("click", () => loadArticles(i))
    pagination.appendChild(btn)
  }
}

// Search
searchBtn.addEventListener("click", async () => {
  const query = document.getElementById("searchInput").value.trim()
  if (!query) {
    alert("Please enter a search query")
    return
  }

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
    const data = await response.json()
    displayArticles(data.results)
    pagination.innerHTML = ""
  } catch (error) {
    console.error("Error:", error)
  }
})

// Analytics
async function loadAnalytics() {
  try {
    const response = await fetch("/api/stats")
    const data = await response.json()
    displayStats(data)
  } catch (error) {
    console.error("Error:", error)
  }
}

function displayStats(data) {
  const stats = data.stats
  const total = data.total_analyzed

  // Update stat cards
  document.getElementById("totalAnalyzed").textContent = total
  document.getElementById("legitCount").textContent = stats.legitimate
  document.getElementById("suspiciousCount").textContent = stats.suspicious
  document.getElementById("spamCount").textContent = stats.spam + stats.likely_spam

  // Pie chart
  const colors = ["#10b981", "#f59e0b", "#ef4444", "#ef4444"]
  const labels = ["Legitimate", "Suspicious", "Likely Spam", "Spam"]
  const values = [stats.legitimate, stats.suspicious, stats.likely_spam, stats.spam]

  // Combine spam categories
  const chartValues = [stats.legitimate, stats.suspicious, stats.likely_spam + stats.spam]
  const chartLabels = ["Legitimate", "Suspicious", "Spam"]
  const chartColors = ["#10b981", "#f59e0b", "#ef4444"]

  displayPieChart(chartValues, chartLabels, chartColors)
  displayBarChart(stats)
}

function displayPieChart(values, labels, colors) {
  const total = values.reduce((a, b) => a + b, 0)
  const pieChart = document.getElementById("pieChart")
  const pieLegend = document.getElementById("pieLegend")

  let cumulativeDegrees = 0
  const pie = ""
  pieLegend.innerHTML = ""

  values.forEach((value, index) => {
    const percentage = (value / total) * 100
    const degrees = (percentage / 100) * 360
    const startDegrees = cumulativeDegrees
    cumulativeDegrees += degrees

    // Create pie segment
    const largeArc = degrees > 180 ? 1 : 0
    const isSmall = percentage < 5

    const legendItem = document.createElement("div")
    legendItem.className = "legend-item"
    legendItem.innerHTML = `
            <div class="legend-color" style="background: ${colors[index]}"></div>
            <div class="legend-text">
                <div class="legend-name">${labels[index]}</div>
                <div class="legend-count">${value} (${percentage.toFixed(1)}%)</div>
            </div>
        `
    pieLegend.appendChild(legendItem)
  })

  // Simple pie chart using conic gradient
  const gradientStops = []
  let currentPercent = 0

  values.forEach((value, index) => {
    const percentage = (value / total) * 100
    const nextPercent = currentPercent + percentage
    gradientStops.push(`${colors[index]} ${currentPercent}%`)
    gradientStops.push(`${colors[index]} ${nextPercent}%`)
    currentPercent = nextPercent
  })

  pieChart.style.background = `conic-gradient(${gradientStops.join(", ")})`
}

function displayBarChart(stats) {
  const barChart = document.getElementById("barChart")
  barChart.innerHTML = ""

  const data = [
    { label: "Legitimate", value: stats.legitimate, color: "#10b981" },
    { label: "Suspicious", value: stats.suspicious, color: "#f59e0b" },
    { label: "Likely Spam", value: stats.likely_spam, color: "#ef4444" },
    { label: "Spam", value: stats.spam, color: "#dc2626" },
  ]

  const maxValue = Math.max(...data.map((d) => d.value), 1)

  data.forEach((item) => {
    const percentage = (item.value / maxValue) * 100
    const barItem = document.createElement("div")
    barItem.className = "bar-item"
    barItem.innerHTML = `
            <div class="bar-label">${item.label}</div>
            <div class="bar-container">
                <div class="bar-fill" style="width: ${percentage}%; background: ${item.color};">
                    ${item.value}
                </div>
            </div>
        `
    barChart.appendChild(barItem)
  })
}

// Export
exportBtn.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/export")
    const data = await response.json()

    const json = JSON.stringify(data.articles, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `spam-detection-${new Date().toISOString().split("T")[0]}.json`
    a.click()
  } catch (error) {
    console.error("Error:", error)
  }
})

// Initialize
window.addEventListener("DOMContentLoaded", () => {
  loadAnalytics()
})
