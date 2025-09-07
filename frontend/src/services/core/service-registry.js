// src/services/core/service-registry.js
// 服务注册和依赖管理

class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.dependencies = new Map();
    this.initialized = new Set();
  }

  // 服务注册
  register(name, serviceClass, dependencies = []) {
    if (this.services.has(name)) {
      console.warn(`服务 ${name} 已存在，将被覆盖`);
    }
    
    this.services.set(name, {
      serviceClass,
      dependencies,
      instance: null
    });
    
    this.dependencies.set(name, dependencies);
    console.log(`已注册服务: ${name}`);
  }

  // 获取服务实例
  get(serviceName) {
    if (!this.services.has(serviceName)) {
      throw new Error(`服务 ${serviceName} 未注册`);
    }

    const serviceInfo = this.services.get(serviceName);
    
    // 如果已经有实例，直接返回
    if (serviceInfo.instance) {
      return serviceInfo.instance;
    }

    // 创建新实例
    return this.createInstance(serviceName);
  }

  // 创建服务实例
  createInstance(serviceName) {
    const serviceInfo = this.services.get(serviceName);
    
    if (!serviceInfo) {
      throw new Error(`服务 ${serviceName} 未注册`);
    }

    // 检查循环依赖
    this.checkCircularDependency(serviceName, new Set());

    // 解析依赖
    const resolvedDependencies = this.resolveDependencies(serviceName);
    
    // 创建实例
    const instance = new serviceInfo.serviceClass(...resolvedDependencies);
    serviceInfo.instance = instance;
    
    // 注入依赖
    this.injectDependencies(instance, resolvedDependencies);
    
    return instance;
  }

  // 解析依赖
  resolveDependencies(serviceName) {
    const dependencies = this.dependencies.get(serviceName) || [];
    return dependencies.map(depName => this.get(depName));
  }

  // 依赖注入
  injectDependencies(service, dependencies) {
    if (typeof service.setDependencies === 'function') {
      service.setDependencies(dependencies);
    }
    
    // 调用服务的初始化方法
    if (typeof service.initialize === 'function') {
      service.initialize();
    }
  }

  // 检查循环依赖
  checkCircularDependency(serviceName, visited) {
    if (visited.has(serviceName)) {
      const cycle = Array.from(visited).join(' -> ') + ' -> ' + serviceName;
      throw new Error(`检测到循环依赖: ${cycle}`);
    }

    visited.add(serviceName);
    const dependencies = this.dependencies.get(serviceName) || [];
    
    for (const dep of dependencies) {
      this.checkCircularDependency(dep, new Set(visited));
    }
  }

  // 服务生命周期管理
  initialize() {
    console.log('开始初始化所有服务...');
    
    // 按依赖顺序初始化服务
    const initOrder = this.getInitializationOrder();
    
    for (const serviceName of initOrder) {
      try {
        const service = this.get(serviceName);
        this.initialized.add(serviceName);
        console.log(`服务 ${serviceName} 初始化完成`);
      } catch (error) {
        console.error(`服务 ${serviceName} 初始化失败:`, error);
      }
    }
    
    console.log('所有服务初始化完成');
  }

  // 获取初始化顺序（拓扑排序）
  getInitializationOrder() {
    const visited = new Set();
    const stack = [];
    
    const visit = (serviceName) => {
      if (visited.has(serviceName)) return;
      
      visited.add(serviceName);
      const dependencies = this.dependencies.get(serviceName) || [];
      
      for (const dep of dependencies) {
        visit(dep);
      }
      
      stack.push(serviceName);
    };

    for (const serviceName of this.services.keys()) {
      visit(serviceName);
    }
    
    return stack;
  }

  // 销毁所有服务
  destroy() {
    console.log('开始销毁所有服务...');
    
    // 按相反顺序销毁
    const destroyOrder = Array.from(this.initialized).reverse();
    
    for (const serviceName of destroyOrder) {
      try {
        const serviceInfo = this.services.get(serviceName);
        if (serviceInfo && serviceInfo.instance) {
          // 调用服务的销毁方法
          if (typeof serviceInfo.instance.destroy === 'function') {
            serviceInfo.instance.destroy();
          }
          serviceInfo.instance = null;
        }
        this.initialized.delete(serviceName);
        console.log(`服务 ${serviceName} 已销毁`);
      } catch (error) {
        console.error(`服务 ${serviceName} 销毁失败:`, error);
      }
    }
    
    console.log('所有服务已销毁');
  }

  // 获取服务状态
  getServiceStatus() {
    const status = {};
    
    for (const [name, serviceInfo] of this.services) {
      status[name] = {
        registered: true,
        instantiated: !!serviceInfo.instance,
        initialized: this.initialized.has(name),
        dependencies: this.dependencies.get(name) || []
      };
    }
    
    return status;
  }

  // 重新加载服务
  reload(serviceName) {
    if (!this.services.has(serviceName)) {
      throw new Error(`服务 ${serviceName} 未注册`);
    }

    const serviceInfo = this.services.get(serviceName);
    
    // 销毁现有实例
    if (serviceInfo.instance && typeof serviceInfo.instance.destroy === 'function') {
      serviceInfo.instance.destroy();
    }
    
    // 清除实例
    serviceInfo.instance = null;
    this.initialized.delete(serviceName);
    
    // 重新创建
    return this.get(serviceName);
  }

  // 检查服务健康状态
  async checkHealth() {
    const healthStatus = {};
    
    for (const [name, serviceInfo] of this.services) {
      if (serviceInfo.instance && typeof serviceInfo.instance.healthCheck === 'function') {
        try {
          healthStatus[name] = await serviceInfo.instance.healthCheck();
        } catch (error) {
          healthStatus[name] = {
            status: 'unhealthy',
            error: error.message
          };
        }
      } else {
        healthStatus[name] = {
          status: serviceInfo.instance ? 'healthy' : 'not_instantiated'
        };
      }
    }
    
    return healthStatus;
  }
}

// 创建全局服务注册器实例
export const serviceRegistry = new ServiceRegistry();

// 便捷方法
export const registerService = (name, serviceClass, dependencies) => {
  serviceRegistry.register(name, serviceClass, dependencies);
};

export const getService = (name) => {
  return serviceRegistry.get(name);
};
export { ServiceRegistry };
export default serviceRegistry;