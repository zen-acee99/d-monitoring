import { matchNames } from './test_fixed_matcher.mjs';

console.log('1. Dy Leah Balderama == Leah B. Dy:', matchNames("Dy Leah Balderama", "Leah B. Dy"));
console.log('2. The == DE LEON, KEN MATTHEW L.:', matchNames("The", "DE LEON, KEN MATTHEW L."));
console.log('3. on == DE LEON, KEN MATTHEW L.:', matchNames("on", "DE LEON, KEN MATTHEW L."));
console.log('4. ODONO-CALIMPONG, ANNABEL C. == Annabel C. Odono-Calimpong:', matchNames("ODONO-CALIMPONG, ANNABEL C.", "Annabel C. Odono-Calimpong"));
console.log('5. Balana Danrev Anonuevo == Danrev A. Balana:', matchNames("Balana Danrev Anonuevo", "Danrev A. Balana"));
console.log('6. Cantorna Michael Verano == Michael Cantorna:', matchNames("Cantorna Michael Verano", "Michael Cantorna"));
console.log('7. Buena Rene Jane Rosendo == Rene Jane R. Buena:', matchNames("Buena Rene Jane Rosendo", "Rene Jane R. Buena"));
console.log('8. to == Ace Malto:', matchNames("to", "Ace Malto"));
console.log('9. in == John Vincent Macha:', matchNames("in", "John Vincent Macha"));
