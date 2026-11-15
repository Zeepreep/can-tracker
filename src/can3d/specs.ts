// Aluminium beverage can sizes. All lengths in millimetres.
// Verified = read from a manufacturer product specification (nomoq.com "Product Specifications": 250 ml slim 04_5_1_53_250_1_04,
// 330 ml sleek 04_5_1_58_330_1_05, 500 ml standard 04_5_1_66_500_1_06). The body diameters of the 355/473 sleek sizes come from the
// print-area circumference in Ball's European design guide (printguides.ball.com); their overall heights are ESTIMATES
// (330 sleek height + the difference in printable height), so they are flagged approx and shown as "estimated" in the app.
export type CanSizeId = 'slim250' | 'sleek330' | 'sleek355' | 'sleek473' | 'std500';

export interface CanSpec {
  id: CanSizeId;
  label: string;          // shown in the size picker (English; translated by the app)
  volumeMl: number;
  diameter: number;       // outside body diameter
  height: number;         // overall seamed height
  neckPlugDia: number;    // diameter of the neck below the seam
  neckHeight: number;     // straight neck section height
  flangeDia: number;      // outside diameter of the double seam (top rim)
  standDia: number;       // diameter of the ring the can stands on
  approx: boolean;
}

export const SPECS: Record<CanSizeId, CanSpec> = {
  slim250: { id: 'slim250', label: '250 ml slim', volumeMl: 250, diameter: 53.4, height: 134.0, neckPlugDia: 50.0, neckHeight: 8, flangeDia: 55.0, standDia: 46.1, approx: false },
  sleek330: { id: 'sleek330', label: '330 ml sleek', volumeMl: 330, diameter: 58.1, height: 145.4, neckPlugDia: 50.0, neckHeight: 13.2, flangeDia: 55.0, standDia: 46.0, approx: false },
  sleek355: { id: 'sleek355', label: '355 ml sleek', volumeMl: 355, diameter: 58.1, height: 156.4, neckPlugDia: 50.0, neckHeight: 13.2, flangeDia: 55.0, standDia: 46.0, approx: true },
  sleek473: { id: 'sleek473', label: '473 ml sleek', volumeMl: 473, diameter: 63.0, height: 173.4, neckPlugDia: 50.0, neckHeight: 13.2, flangeDia: 55.0, standDia: 46.0, approx: true },
  std500: { id: 'std500', label: '500 ml standard', volumeMl: 500, diameter: 66.3, height: 168.0, neckPlugDia: 52.4, neckHeight: 20, flangeDia: 57.5, standDia: 48.3, approx: false },
};
export const SIZE_IDS = Object.keys(SPECS) as CanSizeId[];
export const DEFAULT_SIZE: CanSizeId = 'slim250';
export const specFor = (id?: string): CanSpec => (id && id in SPECS ? SPECS[id as CanSizeId] : SPECS[DEFAULT_SIZE]);
