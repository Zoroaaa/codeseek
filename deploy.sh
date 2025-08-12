#!/bin/bash

# 磁力快搜项目部署脚本
set -e

echo "🚀 开始部署磁力快搜项目..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_NAME="magnet-search"
WORKER_NAME="magnet-search-api"
DB_NAME="magnet-search-db"

# 检查必需工具
check_tools() {
    echo -e "${BLUE}📋 检查必需工具...${NC}"
    
    if ! command -v git &> /dev/null; then
        echo -e "${RED}❌ Git 未安装${NC}"
        exit 1
    fi
    
    if ! command -v wrangler &> /dev/null; then
        echo -e "${RED}❌ Wrangler 未安装，请运行: npm install -g wrangler${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 工具检查完成${NC}"
}

# 检查配置
check_config() {
    echo -e "${BLUE}📋 检查配置文件...${NC}"
    
    if [ ! -f "worker.js" ]; then
        echo -e "${RED}❌ worker.js 文件不存在${NC}"
        exit 1
    fi
    
    if [ ! -f "schema.sql" ]; then
        echo -e "${RED}❌ schema.sql 文件不存在${NC}"
        exit 1
    fi
    
    if [ ! -f "index.html" ]; then
        echo -e "${RED}❌ index.html 文件不存在${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 配置文件检查完成${NC}"
}

# 部署Worker
deploy_worker() {
    echo -e "${BLUE}🔧 部署Cloudflare Worker...${NC}"
    
    # 检查是否已登录
    if ! wrangler whoami &> /dev/null; then
        echo -e "${YELLOW}⚠️  请先登录: wrangler login${NC}"
        exit 1
    fi
    
    # 部署Worker
    wrangler publish worker.js --name $WORKER_NAME
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Worker 部署成功${NC}"
    else
        echo -e "${RED}❌ Worker 部署失败${NC}"
        exit 1
    fi
}

# 初始化数据库
init_database() {
    echo -e "${BLUE}🗄️  初始化数据库...${NC}"
    
    # 检查数据库是否存在
    if wrangler d1 info $DB_NAME &> /dev/null; then
        echo -e "${YELLOW}⚠️  数据库已存在，跳过创建${NC}"
    else
        echo -e "${BLUE}📦 创建数据库...${NC}"
        wrangler d1 create $DB_NAME
    fi
    
    # 执行数据库迁移
    echo -e "${BLUE}🔄 执行数据库迁移...${NC}"
    wrangler d1 execute $DB_NAME --file=schema.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 数据库初始化完成${NC}"
    else
        echo -e "${RED}❌ 数据库初始化失败${NC}"
        exit 1
    fi
}

# 部署前端
deploy_frontend() {
    echo -e "${BLUE}🌐 部署前端到Cloudflare Pages...${NC}"
    
    # 检查是否有Git仓库
    if [ ! -d ".git" ]; then
        echo -e "${YELLOW}⚠️  初始化Git仓库...${NC}"
        git init
        git add .
        git commit -m "Initial commit"
    fi
    
    # 检查是否有远程仓库
    if ! git remote get-url origin &> /dev/null; then
        echo -e "${YELLOW}⚠️  请先设置远程仓库: git remote add origin <your-repo-url>${NC}"
        echo -e "${BLUE}💡 然后运行: git push -u origin main${NC}"
        echo -e "${BLUE}📝 接下来请在Cloudflare Pages中连接此仓库${NC}"
    else
        echo -e "${BLUE}📤 推送代码到远程仓库...${NC}"
        git add .
        git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')" || true
        git push
        
        echo -e "${GREEN}✅ 代码已推送到远程仓库${NC}"
        echo -e "${BLUE}📝 请在Cloudflare Pages中配置自动部署${NC}"
    fi
}

# 设置环境变量
setup_env_vars() {
    echo -e "${BLUE}⚙️  设置环境变量...${NC}"
    
    # 生成JWT Secret
    JWT_SECRET=$(openssl rand -base64 32)
    
    echo -e "${YELLOW}📋 请在Cloudflare Worker中设置以下环境变量:${NC}"
    echo -e "${GREEN}JWT_SECRET=${NC} $JWT_SECRET"
    echo -e "${GREEN}ALLOW_REGISTRATION=${NC} true"
    echo -e "${GREEN}MAX_FAVORITES_PER_USER=${NC} 1000"
    
    echo ""
    echo -e "${YELLOW}📋 请在Cloudflare Pages中设置以下环境变量:${NC}"
    echo -e "${GREEN}API_BASE_URL=${NC} https://$WORKER_NAME.your-subdomain.workers.dev"
    echo -e "${GREEN}APP_NAME=${NC} 磁力快搜"
    echo -e "${GREEN}APP_VERSION=${NC} 1.0.0"
}

# 验证部署
verify_deployment() {
    echo -e "${BLUE}🔍 验证部署...${NC}"
    
    WORKER_URL="https://$WORKER_NAME.your-subdomain.workers.dev"
    
    echo -e "${BLUE}🧪 测试API健康检查...${NC}"
    
    if curl -s "$WORKER_URL/api/health" > /dev/null; then
        echo -e "${GREEN}✅ API 响应正常${NC}"
    else
        echo -e "${RED}❌ API 无响应，请检查Worker部署${NC}"
    fi
}

# 显示完成信息
show_completion() {
    echo ""
    echo -e "${GREEN}🎉 部署完成！${NC}"
    echo ""
    echo -e "${BLUE}📋 接下来的步骤:${NC}"
    echo -e "1. 在Cloudflare Workers中绑定D1数据库"
    echo -e "2. 设置Worker环境变量"
    echo -e "3. 在Cloudflare Pages中连接GitHub仓库"  
    echo -e "4. 设置Pages环境变量"
    echo -e "5. 测试完整功能"
    echo ""
    echo -e "${YELLOW}📚 详细说明请参考: README-DEPLOYMENT.md${NC}"
}

# 主函数
main() {
    echo -e "${GREEN}🚀 磁力快搜项目自动部署脚本${NC}"
    echo ""
    
    check_tools
    check_config
    
    # 询问用户要执行的步骤
    echo -e "${BLUE}请选择要执行的操作:${NC}"
    echo "1) 完整部署（推荐）"
    echo "2) 仅部署Worker"
    echo "3) 仅初始化数据库"
    echo "4) 仅部署前端"
    echo "5) 显示环境变量配置"
    echo "6) 验证部署"
    
    read -p "请输入选项 (1-6): " choice
    
    case $choice in
        1)
            deploy_worker
            init_database
            deploy_frontend
            setup_env_vars
            verify_deployment
            show_completion
            ;;
        2)
            deploy_worker
            ;;
        3)
            init_database
            ;;
        4)
            deploy_frontend
            ;;
        5)
            setup_env_vars
            ;;
        6)
            verify_deployment
            ;;
        *)
            echo -e "${RED}❌ 无效选项${NC}"
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
