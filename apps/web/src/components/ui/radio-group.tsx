import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import { optionVariants } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn('flex gap-2', className)}
      {...props}
    />
  );
}

/** A radio drawn as a button with its label inside (spec 9). */
function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(optionVariants({ size: 'option' }), className)}
      {...props}
    />
  );
}

export { RadioGroup, RadioGroupItem };
