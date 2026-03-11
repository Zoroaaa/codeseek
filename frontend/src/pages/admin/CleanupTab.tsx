import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Trash2, CheckCircle } from 'lucide-react';
import { adminApi } from '@/services/api/admin';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export const CleanupTab: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleCleanup = async () => {
    if (!confirm('确定要清理过期数据吗？此操作不可撤销。')) return;
    setLoading(true);
    try { setResult(await adminApi.cleanup()); toast.success('数据清理完成'); } catch { toast.error('清理失败'); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-orange-700 dark:text-orange-400 mb-2">数据清理说明</h3>
            <ul className="text-sm text-orange-600 dark:text-orange-400/80 space-y-1">
              {['清理过期 Session（已超时的登录会话）', '清理过期邮箱验证记录', '清理旧的密码重置日志', '清理过期安全锁定记录', '清理旧的用户行为日志（超过保留期）'].map(t => <li key={t}>• {t}</li>)}
            </ul>
          </div>
        </div>
      </div>
      <div className="flex justify-center">
        <Button variant="primary" onClick={handleCleanup} disabled={loading}>
          {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
          {loading ? '清理中...' : '执行清理'}
        </Button>
      </div>
      {result && (
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-5">
          <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" />清理结果</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[['过期会话', result.expiredSessions], ['过期验证', result.expiredVerifications], ['密码重置日志', result.oldPasswordResetLogs], ['安全锁定', result.oldSecurityLockouts], ['行为日志', result.oldActions ?? result.oldLoginLogs ?? 0]].map(([label, value]) => (
              <div key={label} className="bg-surface-50 dark:bg-surface-900 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-surface-900 dark:text-surface-100">{value ?? 0}</div>
                <div className="text-xs text-surface-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
