function isInvocable(f: Type): f is Complex {
    if ((f instanceof ADT)) {
        return f.types.every(isInvocable);
    }
    return f instanceof Func;
}

function ensureInvocable(val: Complex): Complex {
    if (!isInvocable(val))
        return undefined;

    // Unwrap single functions
    return (val instanceof ADT) && val.types.length === 1 ? <Func>val.types[0] : val;
}

function getParameterType(f: Complex): Type {
    f = ensureInvocable(f);

    // A regular function can be invoked with any argument assignable to its parameter type
    if (f instanceof Func) {
        return f.parameterType
    }

    // A union of functions can be invoked with any argument assignable to an intersection of the parameter types
    if (f instanceof Union) {
        const parameterType = new Intersection(f.types.map((func: Func) => func.parameterType));
        return parameterType;
    }

    // An intersection of functions can be invoked with any argument assignable to a union of the parameter types
    if (f instanceof Intersection) {
        const parameterType = new Union(f.types.map((func: Func) => func.parameterType));
        return parameterType;
    }
}

function getReturnType(f: Complex): (argument: Type) => Type {
    f = ensureInvocable(f);

    // A regular function returns its return type when invoked with a compatible argument
    if (f instanceof Func) {
        const {returnType} = f;
        return (arg: Type) => isAssignable(arg, getParameterType(f)) ? returnType : undefined;
    }

    // A union of functions returns a union of the return types when invoked with a compatible argument
    if (f instanceof Union) {
        const returnType = new Union(f.types.map((func: Func) => func.returnType));
        return (arg: Type) => isAssignable(arg, getParameterType(f)) ? returnType : undefined;
    }

    // An intersection of functions returns the union of the return types of those constituents
    // for which the argument type is assignable to the parameter type
    if (f instanceof Intersection) {
        const funcs = f.types;
        return (arg: Type) => {
            const candidates = funcs.filter((func: Func) => isAssignable(arg, func.parameterType));
            return candidates.length ? new Union(candidates.map((func: Func) => func.returnType)) : undefined;
        }
    }
}

function isAssignable(val: Type, target: Type): boolean {
    if (val === 'any')
        return true;

    // Invocables
    if (isInvocable(val) && isInvocable(target)) {
        // Every parameter of target must be assignable to every parameter of val
        // NOTE: I am not sure if walking a parameter sequence by repeatedly applying "any"
        // is the right thing here, my brain is just too tired at this point
        const targetParams = Array.from((function*(f: Type) {
            while (isInvocable(f)) {
                yield getParameterType(f);
                f = getReturnType(f)('any');
            }
        })(target));
        return !!resolve(val, targetParams);
    }

    // ADTs
    if (target instanceof Intersection)
        return target.types.every(target => isAssignable(val, target));

    if (target instanceof Union)
        return target.types.some(target => isAssignable(val, target));

    if (val instanceof Intersection) {
        return val.types.some(val => isAssignable(val, target));
    }

    if (val instanceof Union) {
        return val.types.every(val => isAssignable(val, target));
    }

    // Plain values
    return target === val;
}

export type Complex = ADT | Func;
export type Type = Complex | string;

// Algebraic types are flattened when self nested
abstract class ADT {
    constructor(public types: Type[]) {
        let TSelf = this.constructor.prototype;
        let flattened = types
            .reduce((arr, t) => t instanceof ADT ? arr.concat(t.types) : arr.concat(t), []);
        this.types = Array.from(new Set(flattened));
    }
}

export class Intersection extends ADT { }
export class Union extends ADT { }
export class Func {
    constructor(public parameterType: Type, public returnType: Type) { }
    public static create(...parameterList: Type[]) {
        let head = parameterList.pop();
        while (parameterList.length) {
            head = new Func(parameterList.pop(), head);
        }
        return head;
    }
}

export function resolve(f: Complex, args: Type[]): Type {
    return args.reduce((f, arg) => { const result = getReturnType(f); return result ? result(arg) : undefined; }, f);
}
