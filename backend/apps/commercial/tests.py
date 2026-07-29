from datetime import date

from django.core.exceptions import ValidationError
from django.test import TestCase

from .models import Area, Contacto, Minera, Subarea


class ContactShiftCycleValidationTests(TestCase):
    def setUp(self):
        minera = Minera.objects.create(name="Minera de prueba")
        area = Area.objects.create(minera=minera, name="Mantención")
        self.subarea = Subarea.objects.create(area=area, name="Taller")

    def test_rejects_incomplete_shift_cycle(self):
        contact = Contacto(first_name="Ana", subarea=self.subarea, active_days=7)

        with self.assertRaises(ValidationError) as context:
            contact.save()

        self.assertIn("rest_days", context.exception.message_dict)
        self.assertIn("active_cycle_start_date", context.exception.message_dict)

    def test_accepts_complete_shift_cycle(self):
        contact = Contacto.objects.create(
            first_name="Ana",
            subarea=self.subarea,
            active_days=7,
            rest_days=7,
            active_cycle_start_date=date(2026, 1, 1),
        )

        self.assertEqual(contact.active_days, 7)
        self.assertEqual(contact.rest_days, 7)