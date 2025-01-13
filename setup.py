import os
from glob import glob
from setuptools import find_namespace_packages, setup
from setuptools.command.build_py import build_py as _build_py


# From https://github.com/pypa/setuptools/pull/1574
class build_py(_build_py):
    def find_package_modules(self, package, package_dir):
        modules = super().find_package_modules(package, package_dir)
        patterns = self._get_platform_patterns(
            self.exclude_package_data,
            package,
            package_dir,
        )

        excluded_module_files = []
        for pattern in patterns:
            excluded_module_files.extend(glob(pattern))

        for f in excluded_module_files:
            for module in modules:
                if module[2] == f:
                    modules.remove(module)
        return modules


os.chdir(os.path.normpath(os.path.join(os.path.abspath(__file__), os.pardir)))

setup(
    packages=find_namespace_packages(),
    include_package_data=True,
    exclude_package_data={
        "": ["configuration.py", "django-admin.py", "build/*"]
    },
    cmdclass={"build_py": build_py},
)
