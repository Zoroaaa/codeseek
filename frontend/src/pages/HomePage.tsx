import React from 'react';
import {
  Search,
  Sparkles,
  Zap,
  Shield,
  Globe,
  ChevronRight,
  Cloud,
  Heart,
  Layers,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuthStore, useThemeStore } from '@/stores';
import { Button } from '@/components/ui';
import { useNavigate, Link } from 'react-router-dom';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: '极速搜索',
      description: '多源并发搜索，快速获取结果，节省您的宝贵时间',
      color: 'bg-amber-500',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: '安全可靠',
      description: '智能过滤有害内容，保护您的设备和隐私安全',
      color: 'bg-emerald-500',
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: '资源丰富',
      description: '聚合多个优质资源站点，一站式搜索体验',
      color: 'bg-blue-500',
    },
    {
      icon: <Cloud className="w-6 h-6" />,
      title: '云端同步',
      description: '收藏和历史记录云端存储，多设备无缝切换',
      color: 'bg-purple-500',
    },
    {
      icon: <Heart className="w-6 h-6" />,
      title: '智能收藏',
      description: '一键收藏喜爱的资源，随时回顾精彩内容',
      color: 'bg-rose-500',
    },
    {
      icon: <Layers className="w-6 h-6" />,
      title: '分类管理',
      description: '清晰的分类体系，快速找到所需资源类型',
      color: 'bg-cyan-500',
    },
  ];

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-lg border-b border-surface-200/50 dark:border-surface-700/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
                <Search className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                磁力快搜
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              {isAuthenticated ? (
                <Button variant="primary" onClick={() => navigate('/main')}>
                  进入主页
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate('/login')}>
                    登录
                  </Button>
                  <Button variant="primary" onClick={() => navigate('/register')}>
                    免费注册
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50 via-white to-white dark:from-primary-950/30 dark:via-surface-950 dark:to-surface-950" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-accent-400/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            <span>简洁高效的磁力搜索工具</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-surface-900 dark:text-surface-100 mb-6 leading-tight">
            一站式
            <span className="bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent">磁力搜索</span>
            <br />
            解决方案
          </h1>
          
          <p className="text-lg sm:text-xl text-surface-600 dark:text-surface-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            聚合多个优质资源站点，提供快速、安全、便捷的搜索体验。
            支持云端同步、智能收藏，让资源管理更轻松。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate(isAuthenticated ? '/main' : '/register')}
              rightIcon={<ChevronRight className="w-5 h-5" />}
            >
              {isAuthenticated ? '开始搜索' : '立即体验'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/login')}
            >
              已有账号？登录
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-50 dark:bg-surface-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-surface-900 dark:text-surface-100 mb-4">
              产品特色
            </h2>
            <p className="text-surface-600 dark:text-surface-400 max-w-2xl mx-auto">
              我们致力于提供最佳的磁力搜索体验，以下是我们产品的核心功能
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300"
              >
                <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-surface-600 dark:text-surface-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-surface-900 dark:text-surface-100 mb-4">
              使用流程
            </h2>
            <p className="text-surface-600 dark:text-surface-400">
              简单三步，开始您的搜索之旅
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: '注册账号', desc: '快速注册，开启个性化体验' },
              { step: '02', title: '搜索资源', desc: '输入关键词，一键搜索全网' },
              { step: '03', title: '收藏管理', desc: '收藏喜爱的资源，随时查看' },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 text-white text-2xl font-bold mb-4 shadow-lg shadow-primary-500/25">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
                  {item.title}
                </h3>
                <p className="text-surface-600 dark:text-surface-400 text-sm">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-500 to-accent-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            准备好开始了吗？
          </h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            立即注册，体验高效便捷的磁力搜索服务
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/register')}
              rightIcon={<ChevronRight className="w-5 h-5" />}
            >
              免费注册
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/login')}
              className="border-white/30 text-white hover:bg-white/10"
            >
              已有账号
            </Button>
          </div>
        </div>
      </section>

      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-surface-200 dark:border-surface-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Search className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-surface-700 dark:text-surface-300">
              磁力快搜
            </span>
          </div>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            © {new Date().getFullYear()} 磁力快搜. 保留所有权利.
          </p>
        </div>
      </footer>
    </div>
  );
};
