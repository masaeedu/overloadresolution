import { Intersection, Union, Func, Type, resolve } from './typesystem';

// Modeling overload resolution process in a simplified type system. In this world only union, 
// intersection, function, and arbitrary nominal types (represented by strings) exist.

// Three rules:
// - For the purposes of overload resolution, a function of arity > 1 is modeled as a curried
//   function of arity 1
// - A union of functions can be invoked with an argument assignable to an intersection of their 
//   parameter types. The result is a union of their return types.
// - An intersection of functions can be invoked with an argument assignable to a union
//   of their parameter types. The result is an appropriately narrowed union of their return
//   types

// Overloading
// let f: ((a: A, b: B, x: C | D | E) => F) & ((g: G, h: H) => I)
// let x = f(new A(), new H());                                   // should not compile
// let x = f(new A(), new B(), new D());                          // x should be typed as F
// let x = f(<A | G>new A(), <B | H>new H());                     // should not compile?
function test1() {
    const f = new Intersection([
        Func.create('a', 'b', new Union(['c', 'd', 'e']), 'f'),
        Func.create('g', 'h', 'i')
    ]);

    console.log(resolve(f, ['a', 'h']));
    console.log(resolve(f, ['a', new Intersection(['b', 'x']), 'd']));
    console.log(resolve(f, [new Union(['a', 'g']), new Union(['b', 'h'])]));
}
test1();
