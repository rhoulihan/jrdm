import yaml from "js-yaml";
import {
  EntitySchema,
  DualityViewSchema,
  ProjectSchema,
  type Entity,
  type DualityView,
  type Project,
} from "./schemas";

export function parseEntity(input: string): Entity {
  return EntitySchema.parse(yaml.load(input));
}

export function stringifyEntity(entity: Entity): string {
  return yaml.dump(EntitySchema.parse(entity), { lineWidth: 100, noRefs: true });
}

export function parseView(input: string): DualityView {
  return DualityViewSchema.parse(yaml.load(input));
}

export function stringifyView(view: DualityView): string {
  return yaml.dump(DualityViewSchema.parse(view), { lineWidth: 100, noRefs: true });
}

export function parseProject(input: string): Project {
  return ProjectSchema.parse(yaml.load(input));
}

export function stringifyProject(project: Project): string {
  return yaml.dump(ProjectSchema.parse(project), { lineWidth: 100, noRefs: true });
}
