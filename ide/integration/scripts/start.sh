#!/bin/bash
# ============================================
# NEXUS ALPHA - FULL STACK STARTUP SCRIPT
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          NEXUS ALPHA - INTEGRATION STARTUP                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# PRE-START CHECKS
# ============================================

echo -e "${YELLOW}[1/6]${NC} Running pre-start checks..."

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}  Creating .env from template...${NC}"
    cp .env.example .env
    echo ""
    echo -e "${RED}ERROR: Please edit .env and add your API keys first!${NC}"
    echo "Required keys:"
    echo "  - ANTHROPIC_API_KEY (required)"
    echo "  - OPENAI_API_KEY (for embeddings)"
    echo "  - GITHUB_TOKEN (for GitHub MCP)"
    echo ""
    exit 1
fi

# Load environment (ignore lines starting with # or empty)
set -a
grep -v '^#' .env | grep -v '^$' > .env.temp
source .env.temp
rm .env.temp
set +a

# Validate required keys
MISSING_KEYS=()

if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "sk-ant-your-anthropic-key-here" ]; then
    MISSING_KEYS+=("ANTHROPIC_API_KEY")
fi

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-your-openai-key-here" ]; then
    MISSING_KEYS+=("OPENAI_API_KEY")
fi

if [ -z "$GITHUB_TOKEN" ] || [ "$GITHUB_TOKEN" = "ghp_your_github_token_here" ]; then
    MISSING_KEYS+=("GITHUB_TOKEN")
fi

if [ ${#MISSING_KEYS[@]} -gt 0 ]; then
    echo -e "${RED}ERROR: Missing required API keys:${NC}"
    for key in "${MISSING_KEYS[@]}"; do
        echo "  - $key"
    done
    echo ""
    echo "Please add these to your .env file before starting."
    exit 1
fi

echo -e "${GREEN}  ✓ Environment validated${NC}"

# ============================================
# START DOCKER SERVICES
# ============================================

echo ""
echo -e "${YELLOW}[2/6]${NC} Starting core infrastructure services..."

# Start database & cache first (Tier 1)
docker-compose up -d postgres qdrant redis

# Wait for database
echo -e "${YELLOW}  Waiting for PostgreSQL...${NC}"
sleep 5
until docker exec nexus-postgres pg_isready -U nexus > /dev/null 2>&1; do
    echo -n "."
    sleep 2
done
echo -e "${GREEN}  ✓ PostgreSQL ready${NC}"

echo -e "${YELLOW}[3/6]${NC} Starting observability & memory services..."

# Start Langfuse & Mem0 (Tier 2)
docker-compose up -d langfuse mem0

# Wait for Langfuse to be ready
echo -e "${YELLOW}  Waiting for Langfuse...${NC}"
sleep 5

echo -e "${YELLOW}[4/6]${NC} Starting MCP servers..."

# Start MCP servers (Tier 3)
docker-compose up -d github-mcp filesystem-mcp

echo -e "${YELLOW}[5/6]${NC} Starting agent core..."

# Start Nanobot
docker-compose up -d nanobot

echo -e "${YELLOW}[6/6]${NC} Starting main application..."

# Start Nexus Alpha
docker-compose up -d nexus-alpha

# ============================================
# HEALTH CHECKS
# ============================================

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Verifying Services${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

check_service() {
    local name=$1
    local url=$2
    local endpoint=$3

    if curl -sf "$url$endpoint" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ $name${NC}"
        return 0
    else
        echo -e "${RED}  ✗ $name${NC}"
        return 1
    fi
}

echo ""
echo "Checking service health..."

check_service "Nexus Alpha" "http://localhost:3000" "/api/health" || true
check_service "Nanobot" "http://localhost:3030" "/health" || true
check_service "Qdrant" "http://localhost:6333" "/health" || true
check_service "Langfuse" "http://localhost:3001" "/api/public/health" || true
check_service "PostgreSQL" "localhost" "5432" || docker exec nexus-postgres pg_isready -U nexus > /dev/null 2>&1 && echo -e "${GREEN}  ✓ PostgreSQL${NC}" || echo -e "${RED}  ✗ PostgreSQL${NC}"
check_service "Redis" "localhost" "6379" || docker exec nexus-redis redis-cli ping > /dev/null 2>&1 && echo -e "${GREEN}  ✓ Redis${NC}" || echo -e "${RED}  ✗ Redis${NC}"

# ============================================
# SUMMARY
# ============================================

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Startup Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Services:${NC}"
echo "  • Nexus Alpha:    http://localhost:3000"
echo "  • Nanobot:        http://localhost:3030"
echo "  • Qdrant:         http://localhost:6333/dashboard"
echo "  • Langfuse:       http://localhost:3001"
echo "  • PostgreSQL:     localhost:5432"
echo "  • Redis:          localhost:6379"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  View logs:    docker-compose logs -f [service]"
echo "  Stop:         docker-compose down"
echo "  Restart:      docker-compose restart [service]"
echo "  Shell:        docker exec -it nexus-alpha sh"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Visit http://localhost:3000 to access Nexus Alpha"
echo "  2. Check Langfuse at http://localhost:3001 for traces"
echo "  3. Query the agent at http://localhost:3030"
echo ""