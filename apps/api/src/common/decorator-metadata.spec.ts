import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';

@Injectable()
class DependencyService {
  getValue(): string {
    return 'injected';
  }
}

@Injectable()
class ConsumerService {
  constructor(private readonly dependency: DependencyService) {}

  read(): string {
    return this.dependency.getValue();
  }
}

// Vite 8 transforms TypeScript with Oxc, which emits decorator metadata from
// tsconfig (experimentalDecorators + emitDecoratorMetadata). Nest relies on it
// for constructor injection without @Inject(). If this test fails, the test
// transformer stopped emitting metadata.
describe('decorator metadata', () => {
  it('emits design:paramtypes for constructor parameters', () => {
    expect(Reflect.getMetadata('design:paramtypes', ConsumerService)).toEqual([
      DependencyService,
    ]);
  });

  it('resolves constructor dependencies through the Nest container', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ConsumerService, DependencyService],
    }).compile();

    expect(moduleRef.get(ConsumerService).read()).toBe('injected');
  });
});
