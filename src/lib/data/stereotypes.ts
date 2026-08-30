/**
 * Suggested stereotypes for UML class boxes.
 *
 * Rather than shipping a separate palette entry per pattern, the shape library
 * offers one generic box and users type/pick a stereotype on the node itself.
 */
export const STEREOTYPES = [
  // Core UML
  "interface",
  "abstract",
  "enumeration",
  "record",
  "utility",
  // GoF patterns
  "singleton",
  "factory",
  "abstractFactory",
  "builder",
  "prototype",
  "adapter",
  "bridge",
  "composite",
  "decorator",
  "facade",
  "flyweight",
  "proxy",
  "chainOfResponsibility",
  "command",
  "interpreter",
  "iterator",
  "mediator",
  "memento",
  "observer",
  "state",
  "strategy",
  "templateMethod",
  "visitor",
  // Layering / DDD
  "entity",
  "valueObject",
  "aggregate",
  "service",
  "repository",
  "controller",
  "dto",
  "event",
  "exception",
  "config",
] as const;
