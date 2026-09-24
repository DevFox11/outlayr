import { SentenceForm } from "@/components/demo/sentence-form";
import { CONTAINER } from "@/lib/layout";

export function Plate() {
    return (
        <section className="bg-tint text-background">
            <div className={`${CONTAINER} py-20 md:py-28`}>
                <SentenceForm />
            </div>
        </section>
    );
}
