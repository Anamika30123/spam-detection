from flask import Flask, render_template, request, jsonify
from datetime import datetime, timedelta
import csv
import os
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
from collections import Counter
import re
import json

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Data directory
DATA_DIR = 'data'
os.makedirs(DATA_DIR, exist_ok=True)
CSV_FILE = os.path.join(DATA_DIR, 'articles.csv')
STATS_FILE = os.path.join(DATA_DIR, 'stats.csv')

# Spam detection keywords and patterns
SPAM_KEYWORDS = {
    'clickbait': ['click here', 'you won\'t believe', 'shocking', 'doctors hate this', 'viral', 
                  'trending now', 'breaking', 'exclusive', 'unbelievable', 'this will', 'what happened next'],
    'fake_news': ['fake news', 'hoax', 'conspiracy', 'illuminati', 'coverup', 'deep state',
                  'secret government', 'truth', 'wake up sheeple', 'mainstream media lies'],
    'spam': ['buy now', 'click here', 'limited time', 'act now', 'guaranteed', 'risk-free',
             'make money fast', 'earn $', 'work from home', 'spam', 'promotional']
}

TRUSTED_SOURCES = {
    'bbc.com', 'reuters.com', 'apnews.com', 'theguardian.com', 'nytimes.com',
    'washingtonpost.com', 'ft.com', 'economist.com', 'aljazeera.com', 'dw.com',
    'bbc.co.uk', 'independent.co.uk', 'telegraph.co.uk', 'cnn.com', 'nbcnews.com',
    'abcnews.com', 'cbsnews.com', 'foxnews.com'
}

class SpamDetector:
    def __init__(self):
        self.spam_keywords = SPAM_KEYWORDS
        self.trusted_sources = TRUSTED_SOURCES
    
    def analyze_text(self, title, content):
        """Analyze text for spam indicators"""
        combined_text = (title + ' ' + content).lower()
        score = 0
        details = {}
        
        # Check for spam keywords
        for category, keywords in self.spam_keywords.items():
            found = [k for k in keywords if k in combined_text]
            if found:
                score += len(found) * 15
                details[category] = found
        
        # Analyze text characteristics
        word_count = len(content.split())
        details['word_count'] = word_count
        
        # Caps lock ratio (excessive caps = spam)
        caps_ratio = sum(1 for c in title if c.isupper()) / max(len(title), 1) * 100
        if caps_ratio > 30:
            score += 20
            details['excessive_caps'] = True
        
        # Exclamation mark ratio
        exclamation_count = title.count('!')
        if exclamation_count > 2:
            score += 10 * exclamation_count
            details['excessive_exclamation'] = True
        
        # Question marks
        question_count = title.count('?')
        if question_count > 1:
            score += 5 * question_count
            details['excessive_questions'] = True
        
        # Numbers in title (common in clickbait)
        if re.search(r'\d+\s*(ways|reasons|things|secrets|tips|tricks)', title.lower()):
            score += 15
            details['clickbait_pattern'] = True
        
        return min(100, score), details
    
    def get_source_credibility(self, url):
        """Calculate credibility based on source"""
        try:
            domain = urlparse(url).netloc.replace('www.', '')
            if domain in self.trusted_sources:
                return 90
            elif domain.endswith(('.edu', '.gov')):
                return 85
            elif domain.endswith('.com'):
                return 60
            else:
                return 40
        except:
            return 20
    
    def get_spam_level(self, spam_score):
        """Classify spam level"""
        if spam_score < 20:
            return 'legitimate'
        elif spam_score < 40:
            return 'suspicious'
        elif spam_score < 60:
            return 'likely_spam'
        else:
            return 'spam'

detector = SpamDetector()

class NewsScraperService:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    
    def scrape_bbc(self):
        """Scrape BBC News"""
        try:
            url = 'https://www.bbc.com/news'
            response = requests.get(url, headers=self.headers, timeout=10)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            articles = []
            for item in soup.find_all('h2', limit=10):
                title = item.get_text(strip=True)
                if title and len(title) > 10:
                    articles.append({
                        'title': title,
                        'source': 'BBC News',
                        'url': 'https://www.bbc.com/news',
                        'category': 'News'
                    })
            return articles
        except Exception as e:
            print(f"BBC scraping error: {e}")
            return []
    
    def scrape_guardian(self):
        """Scrape The Guardian"""
        try:
            url = 'https://www.theguardian.com/international'
            response = requests.get(url, headers=self.headers, timeout=10)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            articles = []
            for item in soup.find_all('a', {'data-link-name': 'article'}, limit=10):
                title = item.get_text(strip=True)
                if title and len(title) > 10:
                    articles.append({
                        'title': title,
                        'source': 'The Guardian',
                        'url': item.get('href', ''),
                        'category': 'News'
                    })
            return articles
        except Exception as e:
            print(f"Guardian scraping error: {e}")
            return []
    
    def scrape_hacker_news(self):
        """Scrape Hacker News (Tech/Science)"""
        try:
            url = 'https://news.ycombinator.com'
            response = requests.get(url, headers=self.headers, timeout=10)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            articles = []
            for item in soup.find_all('span', class_='titleline', limit=10):
                link = item.find('a')
                if link:
                    title = link.get_text(strip=True)
                    articles.append({
                        'title': title,
                        'source': 'Hacker News',
                        'url': link.get('href', ''),
                        'category': 'Tech'
                    })
            return articles
        except Exception as e:
            print(f"Hacker News scraping error: {e}")
            return []
    
    def get_all_articles(self):
        """Scrape from multiple sources"""
        all_articles = []
        all_articles.extend(self.scrape_bbc())
        all_articles.extend(self.scrape_guardian())
        all_articles.extend(self.scrape_hacker_news())
        return all_articles

scraper = NewsScraperService()

def save_article(title, source, url, category, spam_score, spam_level, credibility):
    """Save article to CSV"""
    try:
        file_exists = os.path.isfile(CSV_FILE)
        with open(CSV_FILE, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(['ID', 'Title', 'Source', 'URL', 'Category', 'Spam_Score', 
                                'Spam_Level', 'Credibility', 'Timestamp'])
            
            article_id = int(datetime.now().timestamp())
            writer.writerow([article_id, title, source, url, category, spam_score, 
                            spam_level, credibility, datetime.now().isoformat()])
            
            # Update stats
            update_stats(spam_level)
        return True
    except Exception as e:
        print(f"Save error: {e}")
        return False

def update_stats(spam_level):
    """Update statistics"""
    try:
        stats = {'legitimate': 0, 'suspicious': 0, 'likely_spam': 0, 'spam': 0}
        
        if os.path.isfile(STATS_FILE):
            with open(STATS_FILE, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    for key in stats:
                        stats[key] += int(row.get(key, 0))
        
        stats[spam_level] += 1
        
        with open(STATS_FILE, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=stats.keys())
            writer.writeheader()
            writer.writerow(stats)
    except Exception as e:
        print(f"Stats update error: {e}")

def get_stats():
    """Get statistics"""
    stats = {'legitimate': 0, 'suspicious': 0, 'likely_spam': 0, 'spam': 0}
    if os.path.isfile(STATS_FILE):
        try:
            with open(STATS_FILE, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    for key in stats:
                        stats[key] = int(row.get(key, 0))
        except:
            pass
    return stats

def get_all_articles_from_csv():
    """Get all articles from CSV"""
    articles = []
    if os.path.isfile(CSV_FILE):
        try:
            with open(CSV_FILE, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    articles.append(row)
        except:
            pass
    return articles

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Analyze article for spam"""
    data = request.json
    title = data.get('title', '')
    content = data.get('content', '')
    url = data.get('url', '')
    source = data.get('source', 'Manual Entry')
    category = data.get('category', 'General')
    
    if not title or not content:
        return jsonify({'error': 'Title and content required'}), 400
    
    spam_score, details = detector.analyze_text(title, content)
    credibility = detector.get_source_credibility(url)
    spam_level = detector.get_spam_level(spam_score)
    
    # Save to CSV
    save_article(title, source, url, category, spam_score, spam_level, credibility)
    
    return jsonify({
        'spam_score': spam_score,
        'spam_level': spam_level,
        'credibility': credibility,
        'details': details
    })

@app.route('/api/scrape', methods=['POST'])
def scrape():
    """Scrape articles and analyze them"""
    articles = scraper.get_all_articles()
    results = []
    
    for article in articles:
        title = article.get('title', '')
        content = title  # Using title as content for scraping
        url = article.get('url', '')
        source = article.get('source', '')
        category = article.get('category', '')
        
        spam_score, details = detector.analyze_text(title, content)
        credibility = detector.get_source_credibility(url)
        spam_level = detector.get_spam_level(spam_score)
        
        save_article(title, source, url, category, spam_score, spam_level, credibility)
        
        results.append({
            'title': title,
            'source': source,
            'spam_score': spam_score,
            'spam_level': spam_level,
            'credibility': credibility
        })
    
    return jsonify({'count': len(results), 'articles': results})

@app.route('/api/articles', methods=['GET'])
def get_articles():
    """Get all analyzed articles"""
    articles = get_all_articles_from_csv()
    page = request.args.get('page', 1, type=int)
    per_page = 10
    
    start = (page - 1) * per_page
    end = start + per_page
    
    return jsonify({
        'articles': articles[start:end],
        'total': len(articles),
        'page': page,
        'pages': (len(articles) + per_page - 1) // per_page
    })

@app.route('/api/stats', methods=['GET'])
def stats():
    """Get statistics"""
    stat_data = get_stats()
    articles = get_all_articles_from_csv()
    total = len(articles)
    
    return jsonify({
        'stats': stat_data,
        'total_analyzed': total,
        'spam_percentage': round((stat_data['spam'] + stat_data['likely_spam']) / max(total, 1) * 100, 2)
    })

@app.route('/api/search', methods=['GET'])
def search():
    """Search articles"""
    query = request.args.get('q', '').lower()
    articles = get_all_articles_from_csv()
    
    results = [a for a in articles if query in a.get('Title', '').lower() or 
               query in a.get('Source', '').lower()]
    
    return jsonify({'results': results[:20], 'count': len(results)})

@app.route('/api/export', methods=['GET'])
def export():
    """Export articles as JSON"""
    articles = get_all_articles_from_csv()
    return jsonify({'articles': articles})

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
