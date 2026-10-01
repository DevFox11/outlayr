import { z } from "zod";

const QUERY_PARAMS = /\nparams: [\s\S]*$/u;

const exceptionList = z.array(z.object({ value: z.string().optional() }).catchall(z.custom<z.core.util.JSONType>()));

export function scrubQueryParams<Event extends { properties?: Record<string, z.core.util.JSONType> }>(
    event: Event | null
): Event | null {
    const properties = event?.properties;
    const exceptions = exceptionList.safeParse(properties?.$exception_list);
    if (properties === undefined || !exceptions.success) {
        return event;
    }
    properties.$exception_list = exceptions.data.map(({ value, ...rest }) =>
        value === undefined ? rest : { ...rest, value: value.replace(QUERY_PARAMS, "") }
    );
    return event;
}
